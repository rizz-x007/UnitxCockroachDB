// services/notificationService.js
const { supabaseAdmin } = require('../config/supabase');

/**
 * Creates a system or chat message notification in the database.
 * @param {string} userId - Recipient profile ID.
 * @param {string} message - Notification text content.
 * @param {string} type - Notification type identifier ('info', 'system', 'message', etc).
 * @param {string|null} referenceId - Optional ID linking to an related entity (e.g., room_id).
 * @returns {Promise<Object>} Created database record.
 */
async function createNotification(userId, message, type = 'info', referenceId = null) {
    const { data, error } = await supabaseAdmin
        .from('notifications')
        .insert({
            user_id: userId,
            message: message.trim(),
            type,
            reference_id: referenceId,
            read: false
        })
        .select()
        .single();

    if (error) {
        console.error(`[Notification Service Error]:`, error.message);
        throw error;
    }
    return data;
}

/**
 * Broadcasts an instant realtime socket alert directly to active channels.
 * Prevents transaction blocks if client-side connections fail.
 * @param {string} recipientId - Recipient profile ID.
 * @param {string} eventName - Socket channel event name.
 * @param {Object} payload - Realtime event data payload.
 */
async function broadcastRealtimeEvent(recipientId, eventName, payload) {
    try {
        await supabaseAdmin.channel(`notifications:${recipientId}`).send({
            type: 'broadcast',
            event: eventName,
            payload
        });
    } catch (err) {
        console.error(`[Notification Broadcast Failure]:`, err.message);
    }
}

module.exports = {
    createNotification,
    broadcastRealtimeEvent
};