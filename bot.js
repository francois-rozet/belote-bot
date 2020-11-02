const discord = require('discord.js');
const fetch = require('node-fetch');

// Config

const { prefix, token } = require('./config.json');

// Promises

function setTimeoutPromise(f, ms) {
	return new Promise(function(resolve) {
		setTimeout(function() {
			resolve(f());
		}, ms);
	});
}

function setIntervalPromise(f, ms) {
	return new Promise(function(resolve) {
		const interval = setInterval(function() {
			if (f()) {
				resolve();
				clearInterval(interval);
			}
		}, ms);
	});
}

// discord.js auxiliary functions

function sendCountdown(channel, content='{}', seconds=10) {
	return channel.send(
		content.replace('{}', seconds.toString())
	).then(function(msg) {
		return setIntervalPromise(function() {
			msg.edit(content.replace('{}', (--seconds).toString()));
			return seconds == 0;
		}, 1e3);
	});
}

function awaitMessage(channel, filter=function(m) { return !m.author.bot; }, ms=undefined) {
	return channel.awaitMessages(
		filter, { max: 1, time: ms }
	).then(function(collected) {
		return collected.first();
	}).catch(function() {
		return undefined;
	});
}

// Helper functions

function now() {
	return new Date().toLocaleString();
}

function randInt(x) {
	return Math.floor(Math.random() * x);
}

function argsParseInt(args, defaults) {
	return defaults.map(function(value, index) {
		const parsed = index < args.length ? args[index] : NaN;
		return isNaN(args[index]) ? value : args[index];
	});
}

// Commands

const commands = {
	'help': {
		usage: '[command-name]',
		description: 'describes one command or lists them all',
		action: function(client, msg, args) {
			const embed = new discord.MessageEmbed()
				.setFooter(client.user.username, client.user.avatarURL())
				.setTimestamp();

			if (args.length) {
				const cmd = args[0];

				if (!(cmd in commands))
					return msg.reply('that doesn\'t seem to be a valid command.');

				embed.setTitle(cmd)
					.setDescription(commands[cmd].description)
					.addField(
						'Usage',
						`\`${prefix}${cmd} ${commands[cmd].usage}\``
					);
			} else {
				embed.setTitle(`${client.user.username} help`);

				var description = '';

				Object.entries(commands).forEach(function(entry) {
					const [cmd, value] = entry;
					description += `\`${prefix}${cmd}\` ${value.description}\n`;
				});

				embed.setDescription(description);
			}

			return msg.channel.send(embed);
		}
	},
	'prune': {
		usage: 'number',
		description: 'deletes messages in the channel',
		action: function(client, msg, args) {
			args = argsParseInt(args, [1]);

			const number = Math.min(100, Math.max(2, args[0] + 1));

			return msg.channel.bulkDelete(number, true).catch(function(err) {
				console.error(err);
				msg.reply('there was an error trying to prune messages.');
			});
		}
	},
	'diceroll': {
		usage: '[sides] [dices]',
		description: 'rolls the dice(s)',
		action: function(client, msg, args) {
			args = argsParseInt(args, [6, 1]);

			const sides = Math.max(2, args[0]);
			const dices = Math.max(1, args[1]);

			const arr = Array(dices);

			for (let i = 0; i < dices; ++i)
				arr[i] = (randInt(sides) + 1).toString();

			return msg.reply(`the (g)odds have spoken.\n${arr.join(', ')}`);
		}
	},
	'mcquiz': {
		usage: '[number] [seconds] [difficulty]',
		description: 'starts a multiple choice quiz',
		action: async function(client, msg, args) {
			const difficulty = args.length > 2 ? args[2] : '';

			args = argsParseInt(args, [10, 20]);

			const number = Math.max(1, args[0]);
			const seconds = Math.max(1, args[1]);
			const ms = seconds * 1e3;

			// Description
			msg.channel.send(new discord.MessageEmbed()
				.setTitle('The MCQuiz')
				.setDescription('Answer multiple choice questions and rank among your friends.')
				.addField(
					'Rules',
					[
						`- Players are asked ${number} questions in their DMs.`,
						`- They have ${seconds} seconds to answer each question.`,
						'- Each question has propositions to choose from.',
						'- Each valid answer is worth one point.',
						'- The winner is the one with the most points.'
					].join('\n')
				)
				.setFooter(client.user.username, client.user.avatarURL())
				.setTimestamp()
			);

			// Get players
			msg.reply('tag the players!');
			const players = (await awaitMessage(msg.channel, function(m) {
				return m.author.id == msg.author.id;
			})).mentions.users.array();

			// Get questions
			msg.channel.startTyping();

			const questions = await fetch(
				`https://opentdb.com/api.php?encode=url3986&amount=${number}&difficulty${difficulty}`,
				{ method: 'GET' }
			).then(function(res) {
				return res.json();
			}).then(function(data) {
				return data['results'];
			});

			msg.channel.stopTyping();

			// Countdown
			await sendCountdown(msg.channel, 'The quiz will start in {}', 5);

			// Ask questions
			const scores = players.map(function() { return 0; });
			const scoreboard = new discord.MessageEmbed()
				.setTitle('The Quiz - Scoreboard')
				.setFooter(client.user.username, client.user.avatarURL());

			for (let i = 0; i < questions.length; ++i) {
				const question = unescape(questions[i]['question']);
				const incorrects = questions[i]['incorrect_answers'].map(unescape);
				const correct = unescape(questions[i]['correct_answer']);

				const propositions = incorrects.slice();
				propositions.splice(randInt(incorrects.length + 1), 0, correct);

				let answers = await Promise.all(players.map(function(player) {
					return player.send(
						`${question}\n${propositions.join(' | ')}`
					).then(function() {
						return awaitMessage(
							player.dmChannel, undefined, ms
						).then(function(value) {
							if (value == undefined)
								player.send('Time\'s up!');

							return value == undefined ? '' : value.content.trim();
						});
					});
				})).then(async function(value) {
					await setTimeoutPromise(function() {}, 2e3);
					return value;
				});

				msg.channel.startTyping();

				scoreboard.addField(
					`Q${i + 1}`,
					`${question}\n✅ ${correct} (❌ ${incorrects.join(' | ')})\n\n` +
					answers.map(function(value, index) {
						var emoji = '✅';

						if (value.toLowerCase() == correct.toLowerCase())
							++scores[index];
						else
							emoji = '❌';

						return `${players[index].username}: ${value} ${emoji}`;
					}).join('\n')
				)

				msg.channel.stopTyping();
			}

			players.forEach(function(player) {
				player.send('The End!');
			});

			msg.channel.startTyping();

			const board = scores.map(function(value, index) {
				return [players[index], value];
			}).sort(function(a, b) {
				return b[1] - a[1]; // reversed sort
			});

			scoreboard.setTimestamp()
				.setDescription(
					board.map(function(value) {
						return `${value[0].username}: ${value[1]}`;
					}).join('\n')
				);

			msg.channel.stopTyping();

			return msg.channel.send(scoreboard);
		}
	}
}

// Client

const client = new discord.Client();

client.on('ready', function() {
	console.log(now() + `; logged in as ${this.user.tag}`);
});

client.on('message', function(msg) {
	// If message doesn't start with prefix or was sent by a bot
	if (!msg.content.startsWith(prefix) || msg.author.bot)
		return;

	const args = msg.content.slice(prefix.length).trim().split(/ +/);
	const cmd = args.shift().toLowerCase();

	// If message is a command
	if (cmd in commands) {
		console.log(now() + `; ${msg.author.tag} triggered ${cmd}(${args})`);
		return commands[cmd].action(this, msg, args);
	}
});

client.login(token);
