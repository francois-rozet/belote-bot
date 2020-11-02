// Config

const { prefix, token } = require('./config.json');

// Time

function now() {
	return new Date().toLocaleString();
}

// Commands

const commands = {
	'help': {
		usage: '[command-name]',
		description: 'describes one command or lists them all',
		action: function(client, msg, args) {
			const embed = new Discord.MessageEmbed()
				.setFooter(client.user.username, client.user.avatarURL())
				.setTimestamp();

			if (args.length > 0) {
				const cmd = args[0];

				if (!(cmd in commands))
					return msg.reply('that doesn\'t seem to be a valid command.');

				embed.setTitle(cmd)
					.setDescription(commands[cmd]['description'])
					.addField(
						'Usage',
						`\`${prefix}${cmd} ${commands[cmd]['usage']}\``
					);
			} else {
				embed.setTitle(`${client.user.username} help`);

				var description = '';

				Object.entries(commands).forEach(function(entry) {
					const [cmd, value] = entry;
					description += `\`${prefix}${cmd}\` ${value['description']}\n`;
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
			var amount = parseInt(args[0]) + 1;

			if (isNaN(amount))
				return msg.reply('this number is invalid.');

			amount = Math.max(2, amount);
			amount = Math.min(100, amount);

			msg.channel.bulkDelete(amount, true).catch(function(err) {
				console.error(err);
				msg.reply('there was an error trying to prune messages.');
			});
		}
	},
	'diceroll': {
		usage: '[sides] [dices]',
		description: 'rolls the dice(s)',
		action: function(client, msg, args) {
			var sides = 6;
			var dices = 1;

			if (args.length > 0) {
				sides = parseInt(args[0]);
				if (args.length > 1)
					dices = parseInt(args[0]);
			}

			if (isNaN(sides) || isNaN(dices))
				return msg.reply('these numbers are invalid.');

			sides = Math.max(2, sides);
			dices = Math.max(1, dices);

			const arr = Array(dices);

			for (var i = 0; i < dices; ++i)
				arr[i] = Math.floor(Math.random() * sides).toString();

			return msg.reply(`the gods have spoken.\n${arr.join(', ')}`);
		}
	}
}

// Client

const Discord = require('discord.js');
const client = new Discord.Client();

client.on('ready', function() {
	console.log(`${now()}; logged in as ${this.user.tag}`);
});

client.on('message', function(msg) {
	// If message doesn't start with prefix or was sent by a bot
	if (!msg.content.startsWith(prefix) || msg.author.bot)
		return;

	const args = msg.content.slice(prefix.length).trim().split(/ +/);
	const cmd = args.shift().toLowerCase();

	// If message is a command
	if (cmd in commands) {
		console.log(`${now()}; ${msg.author.tag} triggered ${cmd}(${args})`);
		return commands[cmd]['action'](this, msg, args);
	}
});

client.login(token);
