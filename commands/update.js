const { exec } = require('child_process');

// Replace this with your actual public GitHub repository URL
const ORIGINAL_REPO_URL = 'https://github.com/Swills01/King-Bambi-V3-Bot-.git';

module.exports = {
    name: 'update',
    description: 'Pull the latest changes directly from the official repository and restart the bot',
    async execute(sock, m, from, args, isOwner) {
        await sock.sendMessage(from, { text: '🔄 Fetching latest updates from the official repository...' }, { quoted: m });

        // Force pull from your official repository main branch
        const updateCmd = `git pull ${ORIGINAL_REPO_URL} main`;

        exec(updateCmd, async (error, stdout, stderr) => {
            if (error) {
                console.error(`🔥 [UPDATE ERROR]: ${error.message}`);
                await sock.sendMessage(from, { text: `❌ Update failed (You might have local conflicts):\n\`\`\`${error.message}\`\`\`` }, { quoted: m });
                return;
            }

            if (stderr) {
                console.warn(`⚠️ [UPDATE STDERR]: ${stderr}`);
            }

            console.log(`📥 [GIT PULL OUTPUT]:\n${stdout}`);

            exec('git log -n 3 --pretty=format:"- %s (%an)"', async (logErr, logStdout) => {
                let updateDetails = stdout.trim();
                if (!logErr && logStdout) {
                    updateDetails += `\n\n📜 *Recent Changes:*\n${logStdout}`;
                }

                await sock.sendMessage(from, { 
                    text: `✅ Update successful!\n\`\`\`${updateDetails}\`\`\`\n\n🔄 Restarting bot application...` 
                }, { quoted: m });

                setTimeout(() => {
                    process.exit(0);
                }, 2000);
            });
        });
    }
};
