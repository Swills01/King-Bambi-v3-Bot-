const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const readline = require('readline');
const { getMode } = require('./utils/mode');
const { handleGameMessage } = require('./utils/gameManager');

// --- HARDCODED CREATOR SIGNATURE & SECURITY (DO NOT REMOVE OR TAMPER) ---
const CREATOR_NAME = "SWILLS";
const DISPLAY_CREATOR_NUMBER = "2349129691462";
const CREATOR_NUMBERS = ["2349129691462"];
const CHANNEL_TEXT_LINK = '\n\n📢 *Join SWILLS TECH Channel:*\nhttps://whatsapp.com/channel/0029Vb8Pn4kEAKW6euGPfY2D';

function verifyCreatorIntegrity() {
    if (!CREATOR_NUMBERS.includes("2349129691462") || CREATOR_NAME !== "SWILLS") {
        console.error("❌ CRITICAL ERROR: Creator identity signature has been altered or tampered with!");
        process.exit(1);
    }
}

verifyCreatorIntegrity();

// Global bulletproof error handlers to log all crashes normally in the terminal
process.on('uncaughtException', (err) => {
    console.error('🔥 [CRASH REPORT - UNCAUGHT EXCEPTION]:', err);
    if (err && err.stack) console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 [CRASH REPORT - UNHANDLED REJECTION] At Promise:', promise, 'Reason:', reason);
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

const spamTracker = {};

function getGlobalSettings() {
    const settingsPath = path.join(__dirname, 'settings.json');
    if (fs.existsSync(settingsPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(settingsPath));
            return {
                autoViewStatus: data.autoViewStatus !== undefined ? data.autoViewStatus : 'on',
                autoReaction: data.autoReaction !== undefined ? data.autoReaction : 'on'
            };
        } catch (e) {
            console.error('🔥 [SETTINGS ERROR] Failed to parse settings.json:', e);
        }
    }
    return { autoViewStatus: 'on', autoReaction: 'on' };
}

function getContextEmoji(text = '') {
    const lower = text.toLowerCase();
    if (/(lol|lmao|funny|haha|😂|🤣|giggle|joke|comedy)/i.test(lower)) return '😂';
    if (/(congrats|congratulations|welldone|bravo|party|🎉|🎈|win|victory|success)/i.test(lower)) return '🥳';
    if (/(sad|sorry|rip|pain|crying|😭|😢|pity)/i.test(lower)) return '😢';
    if (/(love|heart|babe|sweet|❤️|😍|kiss)/i.test(lower)) return '❤️';
    if (/(fire|lit|amazing|cool|🔥|awesome|best)/i.test(lower)) return '🔥';
    if (/(wow|omg|shock|damn|surprised|😮)/i.test(lower)) return '😮';
    
    const defaults = ['👍', '🔥', '❤️', '👏', '🙌'];
    return defaults[Math.floor(Math.random() * defaults.length)];
}

async function startBambi() {
    verifyCreatorIntegrity();
    console.log('🔄 Initializing King Bambi-V3 Socket Connection...');
    
    const authPath = path.join(__dirname, 'auth_info');
    const credsPath = path.join(authPath, 'creds.json');
    if (fs.existsSync(authPath) && fs.existsSync(credsPath)) {
        try {
            const creds = JSON.parse(fs.readFileSync(credsPath));
            if (!creds.registered) {
                console.log("⚠️ Detected an incomplete pairing session. Cleaning up auth_info...");
                fs.rmSync(authPath, { recursive: true, force: true });
            }
        } catch (e) {
            console.error('🔥 [AUTH ERROR] Failed reading creds.json:', e);
            fs.rmSync(authPath, { recursive: true, force: true });
        }
    }

    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome')
    });

    sock.commands = new Map();
    const commandPath = path.join(__dirname, 'commands');
    if (fs.existsSync(commandPath)) {
        try {
            const commandFiles = fs.readdirSync(commandPath).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                try {
                    const filePath = path.join(commandPath, file);
                    delete require.cache[require.resolve(filePath)];
                    const required = require(filePath);
                    if (Array.isArray(required)) {
                        for (const cmd of required) {
                            if (cmd.name) sock.commands.set(cmd.name, cmd);
                        }
                    } else if (required && required.name) {
                        sock.commands.set(required.name, required);
                    }
                } catch (cmdLoadErr) {
                    console.error(`🔥 [COMMAND LOAD ERROR] File ${file}:`, cmdLoadErr);
                }
            }
            console.log(`📂 Loaded ${sock.commands.size} commands successfully.`);
        } catch (dirErr) {
            console.error('🔥 [COMMAND DIR ERROR]:', dirErr);
        }
    }

    if (!sock.authState.creds.registered) {
        if (process.stdin.isTTY) {
            const phoneNumber = await question(`Enter your WhatsApp number [Creator: ${CREATOR_NAME}] (with country code): `);
            console.log('⏳ Requesting pairing code from WhatsApp servers, please wait...');
            setTimeout(async () => {
                try {
                    const code = await sock.requestPairingCode(phoneNumber.trim().replace(/[^0-9]/g, ''));
                    console.log(`✨ Your Pairing Code: ${code}`);
                } catch (pairErr) {
                    console.error('🔥 [PAIRING ERROR] Failed to generate pairing code:', pairErr);
                }
            }, 3000);
        } else {
            console.log("⚠️ Non-interactive environment detected.");
        }
    }

    let isStartupBannerSent = false;

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection) {
            console.log(`📡 Connection Status Changed: --> ${connection.toUpperCase()} <--`);
        }
        
        if (connection === 'open') {
            console.log(`--- KING BAMBI-V3 CONNECTED [Creator: ${CREATOR_NAME}] ---`);
            try { rl.close(); } catch (e) {}

            if (!isStartupBannerSent) {
                isStartupBannerSent = true;
                try {
                    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                    const serverTime = new Date().toLocaleString();
                    
                    const activeBanner = 
`┏━━━ 👑 *KING BAMBI-V3* 👑 ━━━┓\n` +
`┃ Status: *V3 ONLINE & ACTIVE* ✅\n` +
`┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
`┃ 🤖 *Bot Name:* KING BAMBI-V3\n` +
`┃ ⚙️ *Version:* v3.0.0\n` +
`┃ 👤 *Creator:* ${CREATOR_NAME}\n` +
`┃ 👨‍💻 *Developer Contact:* https://wa.me/${DISPLAY_CREATOR_NUMBER}\n` +
`┃ ⏱️ *Server Time:* ${serverTime}\n` +
`┗━━━ 👑 *KING BAMBI-V3* 👑 ━━━┛\n` +
`> _👑 *KING BAMBI-V3* 👑 successfully launched_` + CHANNEL_TEXT_LINK;

                    const bannerImagePath = path.join(__dirname, 'banner.png');
                    if (fs.existsSync(bannerImagePath)) {
                        const imageBuffer = fs.readFileSync(bannerImagePath);
                        await sock.sendMessage(botJid, {
                            image: imageBuffer,
                            caption: activeBanner
                        });
                    } else {
                        await sock.sendMessage(botJid, { text: activeBanner });
                    }
                } catch (bannerErr) {
                    console.error('🔥 [BANNER ERROR] Failed sending startup banner:', bannerErr);
                }
            }
        } else if (connection === 'close') {
            const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
            console.error(`🔥 [CONNECTION CLOSED] Status Code: ${statusCode}`, lastDisconnect?.error || 'Unknown disconnect reason');
            
            if (statusCode === DisconnectReason.loggedOut) {
                console.log('⚠️ Device logged out from WhatsApp session. Clear auth_info folder and re-link.');
            } else {
                console.log('🔄 Connection closed/dropped, attempting automatic reconnection in 3 seconds...');
                setTimeout(() => startBambi(), 3000);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const m = messages[0];
            if (!m.message) return;
            
            const from = m.key.remoteJid;
            const settings = getGlobalSettings();

            // 1. Fully Logged Status Handler with Safe Wrappers & Normal Terminal Error Logging
            if (from === 'status@broadcast') {
                if (settings.autoViewStatus === 'on') {
                    (async () => {
                        try {
                            if (m.key) {
                                await sock.readMessages([m.key]).catch((readErr) => {
                                    console.error('🔥 [STATUS READ ERROR]:', readErr);
                                });
                            }

                            if (settings.autoReaction === 'on' && m.message) {
                                const statusText = 
                                    m.message.conversation || 
                                    m.message.extendedTextMessage?.text || 
                                    m.message.imageMessage?.caption || 
                                    m.message.videoMessage?.caption || '';
                                
                                const emoji = getContextEmoji(statusText);
                                const targetParticipant = m.key.participant || m.participant;

                                if (targetParticipant) {
                                    try {
                                        await sock.sendMessage('status@broadcast', {
                                            react: {
                                                text: emoji,
                                                key: m.key
                                            }
                                        }, { statusJidList: [targetParticipant] });
                                    } catch (statusReactErr) {
                                        console.error('🔥 [STATUS AUTO-REACTION ERROR]:', statusReactErr);
                                    }
                                }
                            }
                        } catch (statusHandlerErr) {
                            console.error('🔥 [STATUS VIEW/HANDLER CRASH]:', statusHandlerErr);
                        }
                    })();
                }
                return;
            }

            const sender = m.key.participant || m.key.remoteJid;
            const senderNumber = sender ? sender.replace(/[^0-9]/g, '') : '';
            const isOwner = CREATOR_NUMBERS.includes(senderNumber) || m.key.fromMe;

            if (from.endsWith('@g.us') && sender) {
                try {
                    let act = fs.existsSync('activity.json') ? JSON.parse(fs.readFileSync('activity.json')) : {};
                    if (!act[from]) act[from] = {};
                    if (!act[from][sender]) act[from][sender] = 0;
                    act[from][sender] += 1;
                    fs.writeFileSync('activity.json', JSON.stringify(act));
                } catch (actErr) {
                    console.error('🔥 [ACTIVITY TRACKER ERROR]:', actErr);
                }
            }

            const body = m.message.conversation || m.message.extendedTextMessage?.text || '';

            const isGroup = from.endsWith('@g.us');
            const isChannel = from.endsWith('@newsletter');

            // Normal text auto-reaction with normal terminal logging
            if (settings.autoReaction === 'on' && !m.key.fromMe && (isGroup || isChannel)) {
                try {
                    const reactionEmoji = getContextEmoji(body);
                    await sock.sendMessage(from, { react: { text: reactionEmoji, key: m.key } });
                } catch (autoReactErr) {
                    console.error('🔥 [NORMAL AUTO-REACTION ERROR]:', autoReactErr);
                }
            }

            if (!body) return;

            if (isGroup && !isOwner) {
                try {
                    const groupMetadata = await sock.groupMetadata(from);
                    const participants = groupMetadata.participants;
                    const senderParticipant = participants.find(p => p.id === sender);
                    const isAdmin = senderParticipant && (senderParticipant.admin === 'admin' || senderParticipant.admin === 'superadmin');

                    if (!isAdmin) {
                        let groupSettings = fs.existsSync('settings.json') ? JSON.parse(fs.readFileSync('settings.json')) : {};

                        const isAntiSpamOn = groupSettings.antispam?.[from] === 'on';
                        if (isAntiSpamOn) {
                            const now = Date.now();
                            if (!spamTracker[from]) spamTracker[from] = {};
                            if (!spamTracker[from][sender]) spamTracker[from][sender] = { count: 0, lastTime: now };

                            const userSpam = spamTracker[from][sender];
                            if (now - userSpam.lastTime < 3000) {
                                userSpam.count += 1;
                            } else {
                                userSpam.count = 1;
                            }
                            userSpam.lastTime = now;

                            if (userSpam.count >= 5) {
                                userSpam.count = 0;
                                try { await sock.sendMessage(from, { delete: m.key }); } catch (e) {}

                                if (!groupSettings.spamWarns) groupSettings.spamWarns = {};
                                if (!groupSettings.spamWarns[from]) groupSettings.spamWarns[from] = {};
                                if (!groupSettings.spamWarns[from][sender]) groupSettings.spamWarns[from][sender] = 0;

                                groupSettings.spamWarns[from][sender] += 1;
                                const spamWarnCount = groupSettings.spamWarns[from][sender];
                                fs.writeFileSync('settings.json', JSON.stringify(groupSettings, null, 2));

                                if (spamWarnCount === 1) {
                                    await sock.sendMessage(from, { text: `⚠️ *@${senderNumber}*, stop spamming! This is your 1st warning. Next time you will be kicked.`, mentions: [sender] });
                                } else {
                                    groupSettings.spamWarns[from][sender] = 0;
                                    fs.writeFileSync('settings.json', JSON.stringify(groupSettings, null, 2));

                                    await sock.sendMessage(from, { text: `🚨 *@${senderNumber}* continued spamming after warning and has been kicked!`, mentions: [sender] });
                                    try { await sock.groupParticipantsUpdate(from, [sender], 'remove'); } catch (e) {}
                                }
                                return;
                            }
                        }

                        const badWordsConfig = groupSettings.badwords?.[from];
                        if (badWordsConfig && badWordsConfig.status === 'on' && Array.isArray(badWordsConfig.list)) {
                            const lowerBody = body.toLowerCase();
                            const containsBadWord = badWordsConfig.list.some(word => lowerBody.includes(word.toLowerCase()));

                            if (containsBadWord) {
                                try { await sock.sendMessage(from, { delete: m.key }); } catch (e) {}
                                await sock.sendMessage(from, { text: `⚠️ *@${senderNumber}*, watch your language! Profanity is prohibited in this group.`, mentions: [sender] });
                                return;
                            }
                        }

                        const groupAntilink = groupSettings.antilink?.[from];
                        const linkRegex = /(https?:\/\/)?(www\.)?(chat\.whatsapp\.com\/|t\.me\/|discord\.gg\/|[a-zA-Z0-9-]+\.[a-z]{2,})/i;
                        
                        if (linkRegex.test(body)) {
                            if (groupAntilink && groupAntilink.instant === 'on') {
                                try { await sock.sendMessage(from, { delete: m.key }); } catch (e) {}
                                await sock.sendMessage(from, { text: `🚫 *@${senderNumber}* has been removed instantly for sharing links violating group rules.`, mentions: [sender] });
                                try { await sock.groupParticipantsUpdate(from, [sender], 'remove'); } catch (e) {}
                                return;
                            }

                            if (groupAntilink && groupAntilink.warn === 'on') {
                                try { await sock.sendMessage(from, { delete: m.key }); } catch (e) {}

                                if (!groupSettings.warnings) groupSettings.warnings = {};
                                if (!groupSettings.warnings[from]) groupSettings.warnings[from] = {};
                                if (!groupSettings.warnings[from][sender]) groupSettings.warnings[from][sender] = 0;

                                groupSettings.warnings[from][sender] += 1;
                                const currentWarnings = groupSettings.warnings[from][sender];
                                fs.writeFileSync('settings.json', JSON.stringify(groupSettings, null, 2));

                                if (currentWarnings < 3) {
                                    await sock.sendMessage(from, { text: `⚠️ *@${senderNumber}*, links are strictly prohibited! Warning *[${currentWarnings}/3]*.`, mentions: [sender] });
                                } else {
                                    groupSettings.warnings[from][sender] = 0;
                                    fs.writeFileSync('settings.json', JSON.stringify(groupSettings, null, 2));

                                    await sock.sendMessage(from, { text: `🚨 *@${senderNumber}* has reached 3 link offenses and has been removed instantly!`, mentions: [sender] });
                                    try { await sock.groupParticipantsUpdate(from, [sender], 'remove'); } catch (e) {}
                                }
                                return;
                            }
                        }
                    }
                } catch (groupSecErr) {
                    console.error('🔥 [GROUP SECURITY ERROR]:', groupSecErr);
                }
            }

            const isGameHandled = await handleGameMessage(sock, m, from, body);
            if (isGameHandled) return;

            if (!body.startsWith('!')) return;

            const currentMode = getMode();
            if (currentMode === 'private' && !isOwner) {
                return;
            }

            const args = body.slice(1).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            const command = sock.commands.get(commandName);
            
            if (command) {
                try {
                    await command.execute(sock, m, m.key.remoteJid, args, isOwner);
                } catch (cmdExecErr) {
                    console.error(`🔥 [COMMAND EXECUTION CRASH] [!${commandName}]:`, cmdExecErr);
                    await sock.sendMessage(from, { text: `❌ An error occurred while executing command *!${commandName}*.\n_Details:_ ${cmdExecErr.message}` }).catch(() => {});
                }
            }
        } catch (upsertErr) {
            console.error('🔥 [CRITICAL MESSAGES UPSERT ERROR]:', upsertErr);
        }
    });
}

startBambi();
