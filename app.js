const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialiser Supabase côté serveur
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Stocker les clients connectés
let clients = [];

// Fonction pour notifier les clients d'un nouvel événement
const notifyClients = (message) => {
    clients.forEach(res => res.write(`data: ${JSON.stringify(message)}\n\n`));
};

// 🔴 Écoute des nouveaux messages en temps réel depuis Supabase
supabase.channel('realtime:messages')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        console.log('🔔 Nouveau message:', payload.new);
        notifyClients(payload.new);  // Envoie aux clients connectés
    })
    .subscribe();

// Endpoint pour envoyer un message
app.post('/send-message', async (req, res) => {
    const { username, message } = req.body;

    try {
        const { data, error } = await supabase
            .from('messages')
            .insert([{ username, message }])
            .select();

        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        console.error('❌ Erreur lors de l\'envoi du message:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint pour récupérer les anciens messages
app.get('/get-messages', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        console.error('❌ Erreur lors de la récupération des messages:', error);
        res.status(500).json({ error: error.message });
    }
});

// 🔥 Endpoint SSE (Server-Sent Events) pour envoyer les mises à jour en temps réel au frontend
app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    clients.push(res);

    req.on('close', () => {
        clients = clients.filter(client => client !== res);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Serveur backend en cours d'exécution sur http://localhost:${PORT}`);
});
