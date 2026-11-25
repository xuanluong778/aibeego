"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertStatusTransition = assertStatusTransition;
exports.assertLeadTransition = assertLeadTransition;
exports.assertAppointmentTransition = assertAppointmentTransition;
exports.assertPaymentRefundable = assertPaymentRefundable;
exports.orderStatusFromPaid = orderStatusFromPaid;
const database_1 = require("@marketingspa/database");
function assertStatusTransition(from, to, allowed) {
    const next = allowed[from] || [];
    if (!next.includes(to)) {
        throw new Error(`Invalid status transition ${from} -> ${to}`);
    }
}
function assertLeadTransition(from, to) {
    assertStatusTransition(from, to, {
        NEW: ['CONTACTED', 'QUALIFIED', 'BOOKED', 'LOST'],
        CONTACTED: ['NEW', 'QUALIFIED', 'BOOKED', 'LOST'],
        QUALIFIED: ['CONTACTED', 'BOOKED', 'LOST'],
        BOOKED: ['CONFIRMED', 'CONTACTED', 'LOST'],
        CONFIRMED: ['VISITED', 'BOOKED', 'CONTACTED', 'LOST'],
        VISITED: ['PURCHASED', 'CONFIRMED', 'LOST'],
        PURCHASED: ['VISITED'],
        LOST: ['NEW', 'CONTACTED'],
    });
}
/** Type-surface helpers used by appointments/finance; delegates to assertStatusTransition. */
function assertAppointmentTransition(from, to) {
    assertStatusTransition(from, to, {
        SCHEDULED: ['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW', 'RESCHEDULED', 'IN_PROGRESS'],
        CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED', 'IN_PROGRESS'],
        IN_PROGRESS: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
        RESCHEDULED: ['SCHEDULED', 'CONFIRMED', 'CANCELLED'],
        COMPLETED: [],
        CANCELLED: [],
        NO_SHOW: [],
    });
}
function assertPaymentRefundable(status) {
    assertStatusTransition(status, 'REFUNDED', {
        PAID: ['REFUNDED'],
        PARTIALLY_PAID: ['REFUNDED'],
        REFUNDED: [],
    });
}
function orderStatusFromPaid(orderTotal, paidAmount) {
    if (paidAmount <= 0)
        return database_1.OrderStatus.PENDING;
    if (paidAmount >= orderTotal)
        return database_1.OrderStatus.PAID;
    return database_1.OrderStatus.PARTIALLY_PAID;
}
