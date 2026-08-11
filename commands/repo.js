const fs = require('fs');
const path = require('path');

const REPO_URL = "https://github.com/Swills01/King-Bambi-v3-Bot-.git";
const CREATOR_NAME = "SWILLS";

module.exports = {
    name: 'repo',
    description: 'Displays the official GitHub repository link for KING BAMBI-V3',
    async execute(sock, m, from) {
        const repoText = 
`┏━━━ 👑 *KING BAMBI-V3 REPO* 👑 ━━━┓\n` +
`┃ 🤖 *Bot Name:* KING BAMBI-V3\n` +
`┃ 👤 *Creator:* ${CREATOR_NAME}\n` +
`┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
`┃ 📂 *GitHub Repository Link:*\n` +
`┃ ${REPO_URL}\n` +
`┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
`┃ _Feel free to star ⭐ and fork 🍴 the repo if you like this project!_\n` +
`┗━━━ 👑 *KING BAMBI-V3* 👑 ━━━┛`;

        await sock.sendMessage(from, { text: repoText }, { quoted: m });
    }
};
