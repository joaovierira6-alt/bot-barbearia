import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import express from 'express';
import schedule from 'node-schedule';

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot Barbearia Online 💈'));
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './session' }),
    puppeteer: {
        headless: 'new',
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// ===== CONFIGURA AQUI =====
const MEU_NUMERO = '5551981246261@c.us'; // Teu número com 55
const HORARIOS = [9, 10, 11, 14, 15, 16, 17, 18];
// ==========================

client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('code', code => console.log('CÓDIGO:', code));
client.on('ready', () => console.log('BOT ONLINE! 💈'));

let agendamentos = {};

client.on('message', async msg => {
    const chat = await msg.getChat();
    const contato = await msg.getContact();
    const telefone = contato.number;
    const numeroCliente = `${telefone}@c.us`;
    const nome = contato.pushname || 'Cliente';

    // SAUDAÇÃO
    if (msg.body.toLowerCase().match(/^(oi|olá|ola|menu|bom dia|boa tarde|boa noite)$/)) {
        agendamentos[telefone] = { etapa: 'servico' };
        msg.reply('Salve! 💈 Barbearia do Gui.\n\nO que vamos fazer hoje?\n\n1. Corte R$40\n2. Barba R$30\n3. Corte + Barba R$60\n4. Sobrancelha R$20\n\nManda o número.');
        return;
    }

    // ESCOLHEU SERVIÇO
    if (agendamentos[telefone]?.etapa === 'servico') {
        const servicos = { '1': 'Corte R$40', '2': 'Barba R$30', '3': 'Corte + Barba R$60', '4': 'Sobrancelha R$20' };
        if (servicos[msg.body]) {
            agendamentos[telefone].servico = servicos[msg.body];
            agendamentos[telefone].etapa = 'horario';

            let texto = `Beleza, ${servicos[msg.body]} ✅\n\nQue horas tu prefere hoje?\n\n`;
            HORARIOS.forEach((h, i) => { texto += `${i + 1}. ${h}:00\n`; });
            texto += '\nManda o número do horário.';

            agendamentos[telefone].horarios = HORARIOS;
            msg.reply(texto);
        } else {
            msg.reply('Não entendi. Manda 1, 2, 3 ou 4.');
        }
        return;
    }

    // ESCOLHEU HORÁRIO = TE NOTIFICA
    if (agendamentos[telefone]?.etapa === 'horario') {
        const horarios = agendamentos[telefone].horarios;
        const escolha = parseInt(msg.body) - 1;

        if (horarios[escolha]!== undefined) {
            const horaEscolhida = horarios[escolha];
            const dados = agendamentos[telefone];

            // 1. AVISA CLIENTE
            await msg.reply(`Boa! Anotei teu pedido ✅\n\n📋 ${dados.servico}\n🕐 Hoje ${horaEscolhida}:00\n\nVou confirmar com o barbeiro e já te retorno em 2min pra fechar 💈`);

            // 2. TE NOTIFICA COM TUDO
            client.sendMessage(MEU_NUMERO, `💈 NOVO PEDIDO\n\nCliente: ${nome}\nFone: +${telefone}\nQuer: ${dados.servico}\nHorário pedido: Hoje ${horaEscolhida}:00\n\nConfere no AppBarber se tá livre e confirma pro cliente.`);

            // 3. LEMBRETE 1H ANTES - Só dispara se tu confirmar pro cliente
            const hoje = new Date().toISOString().split('T')[0];
            const dataAgendamento = new Date(`${hoje}T${horaEscolhida}:00:00-03:00`);
            const umaHoraAntes = new Date(dataAgendamento.getTime() - 60 * 60 * 1000);

            schedule.scheduleJob(umaHoraAntes, () => {
                client.sendMessage(numeroCliente, `Opa ${nome}! 💈\n\nLembrando: teu horário é daqui 1h\n📋 ${dados.servico} às ${horaEscolhida}:00\n\nTe espero!`);
            });

            delete agendamentos[telefone];
        } else {
            msg.reply('Esse número não tá na lista. Escolhe um dos horários que te mandei.');
        }
    }
});

client.initialize();
