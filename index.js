import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import express from 'express';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot AppBarber Online'));
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './session' }),
    puppeteer: {
        headless: 'new',
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

const APPBARBER_TOKEN = process.env.APPBARBER_TOKEN;
const APPBARBER_URL = 'https://api.appbarber.com.br';
const ESTABLISHMENT_CODE = process.env.ESTABLISHMENT_CODE;
const MEU_NUMERO = '5551981246261@c.us';

const api = axios.create({
    baseURL: APPBARBER_URL,
    headers: { 'Authorization': `Bearer ${APPBARBER_TOKEN}` }
});

client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('code', code => console.log('CODIGO PAREAMENTO:', code));
client.on('ready', () => console.log('BOT APPBARBER ONLINE'));

let sessoes = {};

client.on('message', async msg => {
    const chat = await msg.getChat();
    const contato = await msg.getContact();
    const telefone = contato.number;
    const nome = contato.pushname || 'Cliente';

    try {
        if (msg.body.toLowerCase().match(/^(oi|olá|ola|menu|bom dia|boa tarde|boa noite)$/)) {
            sessoes[telefone] = { etapa: 'servico' };
            await chat.sendStateTyping();

            const { data } = await api.get('/v1/services', {
                params: { establishment_code: ESTABLISHMENT_CODE, type: 1 }
            });
            const servicos = data.data || data;

            if (!servicos.length) {
                return msg.reply('Nenhum servico cadastrado no sistema.');
            }

            let texto = 'Barbearia do Gui\n\nO que vamos fazer hoje?\n\n';
            servicos.forEach((s, i) => { texto += `${i + 1}. ${s.name} - R$${s.price}\n`; });
            texto += '\nManda o numero.';

            sessoes[telefone].listaServicos = servicos;
            return msg.reply(texto);
        }

        if (sessoes[telefone]?.etapa === 'servico') {
            const escolha = parseInt(msg.body) - 1;
            const servicos = sessoes[telefone].listaServicos;

            if (servicos[escolha]) {
                sessoes[telefone].servico = servicos[escolha];
                sessoes[telefone].etapa = 'barbeiro';
                await chat.sendStateTyping();

                const { data } = await api.get('/v1/professionals', {
                    params: { establishment_code: ESTABLISHMENT_CODE }
                });
                const barbeiros = data.data || data;

                let texto = `Servico: ${servicos[escolha].name}\n\nCom qual barbeiro?\n\n`;
                barbeiros.forEach((b, i) => { texto += `${i + 1}. ${b.name}\n`; });
                texto += '\nManda o numero.';

                sessoes[telefone].listaBarbeiros = barbeiros;
                return msg.reply(texto);
            } else {
                return msg.reply('Opcao invalida. Escolha um numero da lista.');
            }
        }

        if (sessoes[telefone]?.etapa === 'barbeiro') {
            const escolha = parseInt(msg.body) - 1;
            const barbeiros = sessoes[telefone].listaBarbeiros;

            if (barbeiros[escolha]) {
                sessoes[telefone].barbeiro = barbeiros[escolha];
                sessoes[telefone].etapa = 'horario';
                await chat.sendStateTyping();

                const hoje = new Date().toISOString().split('T')[0];

                const { data } = await api.get('/v1/availability', {
                    params: {
                        establishment_code: ESTABLISHMENT_CODE,
                        professional_code: barbeiros[escolha].code,
                        date: hoje
                    }
                });
                const horarios = data.data || data;

                if (!horarios.length) {
                    delete sessoes[telefone];
                    return msg.reply(`Sem horarios disponiveis hoje com ${barbeiros[escolha].name}. Tente amanha enviando "oi" novamente.`);
                }

                let texto = `Barbeiro: ${barbeiros[escolha].name}\n\nHorarios livres hoje:\n\n`;
                horarios.forEach((h, i) => { texto += `${i + 1}. ${h.time}\n`; });
                texto += '\nQual horario?';

                sessoes[telefone].listaHorarios = horarios;
                sessoes[telefone].data = hoje;
                return msg.reply(texto);
            } else {
                return msg.reply('Opcao invalida. Escolha um numero da lista.');
            }
        }

        if (sessoes[telefone]?.etapa === 'horario') {
            const escolha = parseInt(msg.body) - 1;
            const horarios = sessoes[telefone].listaHorarios;

            if (horarios[escolha]) {
                const d = sessoes[telefone];
                await chat.sendStateTyping();

                await api.post('/v1/appointments', {
                    establishment_code: ESTABLISHMENT_CODE,
                    professional_code: d.barbeiro.code,
                    service_code: d.servico.code,
                    date: d.data,
                    time: horarios[escolha].time,
                    client_name: nome,
                    client_phone: telefone
                });

                await msg.reply(`Agendamento confirmado\n\nServico: ${d.servico.name}\nBarbeiro: ${d.barbeiro.name}\nHorario: Hoje ${horarios[escolha].time}\n\nJa esta marcado no sistema. Aguardamos voce.`);

                client.sendMessage(MEU_NUMERO, `AGENDAMENTO CONFIRMADO\n\nCliente: ${nome} +${telefone}\n${d.servico.name} com ${d.barbeiro.name}\nHoje ${horarios[escolha].time}`);

                delete sessoes[telefone];
            } else {
                return msg.reply('Opcao invalida. Escolha um numero da lista.');
            }
        }

    } catch (e) {
        console.error('ERRO:', e.response?.data || e.message);
        msg.reply('Ocorreu um erro no sistema. Entre em contato pelo telefone 51 98124-6261 para agendar.');
        delete sessoes[telefone];
    }
});

client.initialize();
