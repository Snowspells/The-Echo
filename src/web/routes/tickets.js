const express = require('express');
const { requireStaff, requireAuth, STAFF_LEVELS } = require('../middleware/auth');

const router = express.Router();

// Ticket list — staff can see all, regular users see their own
router.get('/', requireAuth, (req, res) => {
    const user = req.session.user;
    const isStaff = user.staffLevel > 0 || user.id === require('../../config').users.ownerId;
    const statusFilter = req.query.status || null;

    let tickets;
    if (isStaff) {
        tickets = statusFilter
            ? req.db.getTicketsByGuild(process.env.STAFF_GUILD_ID, statusFilter)
            : req.db.getAllTickets(200);
    } else {
        tickets = req.db.getTicketsByUser(user.id);
        if (statusFilter) {
            tickets = tickets.filter(t => t.status === statusFilter);
        }
    }

    res.render('tickets', {
        user,
        tickets,
        isStaff,
        currentFilter: statusFilter
    });
});

// View individual ticket transcript
router.get('/:id/transcript', requireAuth, (req, res) => {
    const ticketId = parseInt(req.params.id, 10);
    const ticket = req.db.getTicket(ticketId);
    const user = req.session.user;

    if (!ticket) {
        return res.status(404).render('error', {
            title: '404 - Not Found',
            message: 'Ticket not found.',
            user
        });
    }

    const config = require('../../config');
    const isStaff = user.staffLevel > 0 || user.id === config.users.ownerId;
    const isCreator = ticket.creator_id === user.id;

    if (!isStaff && !isCreator) {
        return res.status(403).render('error', {
            title: '403 - Forbidden',
            message: 'You do not have permission to view this transcript.',
            user
        });
    }

    const transcript = req.db.getTranscript(ticketId);

    res.render('ticket-detail', {
        user,
        ticket,
        transcript,
        isStaff
    });
});

// Raw transcript HTML (for viewing in new tab)
router.get('/:id/transcript/raw', requireAuth, (req, res) => {
    const ticketId = parseInt(req.params.id, 10);
    const ticket = req.db.getTicket(ticketId);
    const user = req.session.user;

    if (!ticket) {
        return res.status(404).send('Ticket not found.');
    }

    const config = require('../../config');
    const isStaff = user.staffLevel > 0 || user.id === config.users.ownerId;
    const isCreator = ticket.creator_id === user.id;

    if (!isStaff && !isCreator) {
        return res.status(403).send('Forbidden.');
    }

    const transcript = req.db.getTranscript(ticketId);

    if (!transcript) {
        return res.status(404).send('No transcript available for this ticket.');
    }

    res.setHeader('Content-Type', 'text/html');
    res.send(transcript.transcript_html);
});

module.exports = router;
