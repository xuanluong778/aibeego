"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateBusinessGoals = calculateBusinessGoals;
function roundMoney(value) {
    return Math.round(value * 100) / 100;
}
function roundPercent(value) {
    return Math.round(value * 100) / 100;
}
function calculateBusinessGoals(input) {
    const { averageRevenuePerTransaction: avgRev, currentTransactionCount: txCount, variableCostRate: varRate, fixedCost, leadConversionRate: convRate, targetProfit, } = input;
    const totalRevenue = roundMoney(avgRev * txCount);
    const variableCost = roundMoney(totalRevenue * (varRate / 100));
    const grossProfit = roundMoney(totalRevenue - variableCost);
    const grossProfitMargin = totalRevenue > 0 ? roundPercent((grossProfit / totalRevenue) * 100) : null;
    const grossProfitPerTransaction = avgRev > 0 ? roundMoney(avgRev * (1 - varRate / 100)) : null;
    let breakEvenTransactions = null;
    if (grossProfitPerTransaction !== null && grossProfitPerTransaction > 0) {
        breakEvenTransactions = Math.ceil(fixedCost / grossProfitPerTransaction);
    }
    let breakEvenLeads = null;
    let breakEvenLeadsInsufficientData = false;
    if (breakEvenTransactions !== null) {
        if (convRate > 0) {
            breakEvenLeads = Math.ceil(breakEvenTransactions / (convRate / 100));
        }
        else {
            breakEvenLeadsInsufficientData = true;
        }
    }
    let targetTransactions = null;
    if (grossProfitPerTransaction !== null && grossProfitPerTransaction > 0) {
        targetTransactions = Math.ceil((fixedCost + targetProfit) / grossProfitPerTransaction);
    }
    let targetLeads = null;
    let targetLeadsInsufficientData = false;
    if (targetTransactions !== null) {
        if (convRate > 0) {
            targetLeads = Math.ceil(targetTransactions / (convRate / 100));
        }
        else {
            targetLeadsInsufficientData = true;
        }
    }
    const netProfit = roundMoney(grossProfit - fixedCost);
    const profitMargin = totalRevenue > 0 ? roundPercent((netProfit / totalRevenue) * 100) : null;
    let status;
    if (netProfit > 0)
        status = 'profit';
    else if (netProfit === 0)
        status = 'break_even';
    else
        status = 'loss';
    return {
        totalRevenue,
        variableCost,
        grossProfit,
        grossProfitMargin,
        grossProfitPerTransaction,
        breakEvenTransactions,
        breakEvenLeads,
        breakEvenLeadsInsufficientData,
        targetTransactions,
        targetLeads,
        targetLeadsInsufficientData,
        netProfit,
        profitMargin,
        status,
    };
}
