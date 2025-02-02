const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Stocker les clients connectés et leurs usernames
let clients = [];

const notifyClients = (message) => {
    clients.forEach(client => client.res.write(`data: ${JSON.stringify(message)}\n\n`));
};

// Écoute des nouveaux messages Supabase
supabase.channel('realtime:messages')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        notifyClients(payload.new);
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
        res.status(500).json({ error: error.message });
    }
});

// SSE : Gérer les connexions et les déconnexions en temps réel
app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Récupérer le username depuis la requête (ex : /events?username=John)
    const username = req.query.username || 'Utilisateur inconnu';
    
    // Ajouter l'utilisateur à la liste des clients connectés
    clients.push({ res, username });
    
    // Notifier les autres que l'utilisateur a rejoint
    notifyClients({ username: 'System', message: `${username} a rejoint le chat.` });

    // Gérer la déconnexion de l'utilisateur
    req.on('close', () => {
        clients = clients.filter(client => client.res !== res);
        notifyClients({ username: 'System', message: `${username} a quitté le chat.` });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Serveur backend en cours d'exécution sur http://localhost:${PORT}`);
});
