import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import express from 'express';
import { execSync } from 'child_process';

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot AppBarber Online'));
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

let chromePath;
try {
    chromePath = execSync('find./chrome -name chrome -type f | head -n 1').toString().trim();
    console.log('Chrome encontrado em:', chromePath);
} catch (e) {
    console.log('Erro ao achar Chrome:', e.message);
}

const MEU_NUMERO = '5551981246261';

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './session' }),
    puppeteer: {
        headless: true,
        executablePath: chromePath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-zygote',
            '--single-process'
        ]
    }
});

client.on('ready', () => console.log('BOT APPBARBER ONLINE E CONECTADO'));
client.on('auth_failure', msg => console.error('FALHA NA AUTENTICACAO', msg));
client.on('disconnected', reason => console.log('DESCONECTADO:', reason));

client.initialize().then(() => {
    setTimeout(async () => {
        try {
            console.log('Solicitando código de pareamento...');
            const pairingCode = await client.requestPairingCode(MEU_NUMERO);
            console.log('================================');
            console.log('CODIGO DE PAREAMENTO:', pairingCode);
            console.log('================================');
        } catch (err) {
            console.log('Erro ao gerar código:', err.message);
        }
    }, 5000);
});

let sessoes = {};

client.on('message', async msg => {
    const chat = await msg.getChat();
    const contato = await msg.getContact();
    const telefone = contato.number;
    const nome = contato.pushname || 'Cliente';
    if (chat.isGroup) return;
    if (msg.body.toLowerCase().match(/^(oi|olá|ola|menu|bom dia|boa tarde|boa noite)$/)) {
        sessoes[telefone] = { etapa: 'aviso' };
        await chat.sendStateTyping();
        return msg.reply('Barbearia do Gui\n\nNosso sistema de agendamento automatico volta amanha.\n\nPor hoje, chama aqui no WhatsApp 51 98124-6261 que a gente marca pra ti.\n\nHorario: 9h as 19h');
    }
    if (sessoes[telefone]?.etapa === 'aviso') {
        await chat.sendStateTyping();
        await msg.reply('Opa. Por hoje marca direto com a gente: 51 98124-6261\n\nAmanha o robo ja marca sozinho.');
        client.sendMessage('5551981246261@c.us', `CLIENTE CHAMOU\n\nNome: ${nome}\nNumero: +${telefone}\nMensagem: ${msg.body}`);
        delete sessoes[telefone];
    }
});
