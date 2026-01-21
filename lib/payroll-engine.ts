
import { Staff, Attendance, Shift } from '@prisma/client';

export const BUSINESS_RULES = {
    // 1. System Config
    FIXED_DENOMINATOR: 26,
    HOURS_PER_DAY: 8,

    // 3. Multipliers
    MULTIPLIERS: {
        NORMAL: 1.0,
        OVERTIME_DAY: 1.5,
        OVERTIME_NIGHT: 2.0,
        WEEKLY_OFF: 2.0,
        HOLIDAY: 3.0,
    },

    // 6. Insurance & Tax (2026)
    INSURANCE: {
        SI_RATE: 0.08,
        SI_CAP: 46_800_000,
        HI_RATE: 0.015,
        HI_CAP: 46_800_000,
        UI_RATE: 0.01,
        UI_CAP: 106_200_000,
        TU_RATE: 0.01,
        TU_CAP_BASE: 23_400_000, // Derived from Max TU 234,000 / 1%
        TU_MAX_AMOUNT: 234_000,
    },
    PIT: {
        PERSONAL_DEDUCTION: 15_500_000,
        DEPENDENT_DEDUCTION: 6_200_000,
        MEAL_ALLOWANCE_EXEMPTION: 730_000, // Non-taxable cap per month
    },

    // Currency
    LOCALE: 'vi-VN',
    CURRENCY: 'VND',
};

// Helper: Format Currency
export function formatCurrencyVND(amount: number): string {
    return new Intl.NumberFormat(BUSINESS_RULES.LOCALE, {
        style: 'currency',
        currency: BUSINESS_RULES.CURRENCY,
        maximumFractionDigits: 0
    }).format(amount);
}

// Helper: Calculate Rates
export function getRates(baseWage: number) {
    const dailyRate = Math.floor(baseWage / BUSINESS_RULES.FIXED_DENOMINATOR);
    const hourlyRate = Math.floor(dailyRate / BUSINESS_RULES.HOURS_PER_DAY);
    return { dailyRate, hourlyRate };
}

// Helper: Calculate Insurance
export function calculateInsurance(insuranceBase: number) {
    // SI
    const siBase = Math.min(insuranceBase, BUSINESS_RULES.INSURANCE.SI_CAP);
    const siAmount = Math.floor(siBase * BUSINESS_RULES.INSURANCE.SI_RATE);

    // HI
    const hiBase = Math.min(insuranceBase, BUSINESS_RULES.INSURANCE.HI_CAP);
    const hiAmount = Math.floor(hiBase * BUSINESS_RULES.INSURANCE.HI_RATE);

    // UI
    const uiBase = Math.min(insuranceBase, BUSINESS_RULES.INSURANCE.UI_CAP);
    const uiAmount = Math.floor(uiBase * BUSINESS_RULES.INSURANCE.UI_RATE);

    // TU (Check rule: 1% capped at 234,000)
    let tuAmount = Math.floor(insuranceBase * BUSINESS_RULES.INSURANCE.TU_RATE);
    if (tuAmount > BUSINESS_RULES.INSURANCE.TU_MAX_AMOUNT) {
        tuAmount = BUSINESS_RULES.INSURANCE.TU_MAX_AMOUNT;
    }

    const totalInsurance = siAmount + hiAmount + uiAmount; // TU is usually Union fee

    return {
        si: siAmount,
        hi: hiAmount,
        ui: uiAmount,
        tu: tuAmount,
        total: totalInsurance + tuAmount
    };
}

// Helper: Calculate PIT
export function calculatePIT(taxableIncome: number) {
    if (taxableIncome <= 0) return 0;

    // Brackets (2026 New 5 Steps)
    let tax = 0;
    let remaining = taxableIncome;

    // Bracket 1: 0 - 10M
    const b1 = 10_000_000;
    if (remaining > 0) {
        const taxable = Math.min(remaining, b1);
        tax += taxable * 0.05;
        remaining -= taxable;
    } else return Math.floor(tax);

    // Bracket 2: 10M - 30M (Range 20M)
    const b2 = 30_000_000 - 10_000_000;
    if (remaining > 0) {
        const taxable = Math.min(remaining, b2);
        tax += taxable * 0.15;
        remaining -= taxable;
    } else return Math.floor(tax);

    // Bracket 3: 30M - 60M (Range 30M)
    const b3 = 60_000_000 - 30_000_000;
    if (remaining > 0) {
        const taxable = Math.min(remaining, b3);
        tax += taxable * 0.25;
        remaining -= taxable;
    } else return Math.floor(tax);

    // Bracket 4: 60M - 100M (Range 40M)
    const b4 = 100_000_000 - 60_000_000;
    if (remaining > 0) {
        const taxable = Math.min(remaining, b4);
        tax += taxable * 0.30;
        remaining -= taxable;
    } else return Math.floor(tax);

    // Bracket 5: > 100M
    if (remaining > 0) {
        tax += remaining * 0.35;
    }

    return Math.floor(tax);
}

// Logic: Calculate Monthly Payroll for a Staff
// Adjustment Interface updated to match Schema
export function calculateStaffPayroll(
    staff: Staff,
    attendanceList: Attendance[],
    shifts: Shift[],
    year: number,
    month: number,
    adjustment?: {
        commission: number,
        incentive: number,
        bonus: number,
        deduction: number,
        allowancePosition: number,
        allowanceCommute: number,
        allowanceCommunication: number,
        allowanceMeal: number,
        allowanceHousing: number,
        allowanceLanguage: number,
        allowanceOther: number,
        fine: number,
        taxRefund: number,
        timelineCommission?: number
    }
) {
    const { dailyRate, hourlyRate } = getRates(staff.baseWage);

    let totalPaidDays = 0; // Days eligible for Base Pay (Worked + Paid Holidays)
    let totalActualWorkDays = 0; // Days actually present

    let basePayTotal = 0;
    let overtimePayTotal = 0;
    let holidayWorkPayTotal = 0;
    let commissionTotal = 0;
    const incentiveTotal = 0;

    // Aggregates for display
    let totalWorkHours = 0;
    let totalOvertimeHours = 0;
    let totalHolidayWorkHours = 0;
    let totalPerfHours = 0;
    let totalReviews = 0;

    // Iterate through all days of the month
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const isHoliday = isVietnamHoliday(date);

        // Find attendance for this day
        const att = attendanceList.find(a =>
            a.date.getDate() === day &&
            a.date.getMonth() === month - 1 &&
            a.date.getFullYear() === year
        );

        const worked = att && att.workHours && att.workHours > 0;

        // Base Pay Logic
        if (worked) {
            totalPaidDays++;
            totalActualWorkDays++;
            basePayTotal += dailyRate;
            totalWorkHours += (att?.workHours || 0);
        } else if (isHoliday) {
            // Paid Holiday: Get Paid even if not worked
            totalPaidDays++;
            basePayTotal += dailyRate;
        }

        // Additional Pay Logic (Overtime / Holiday Bonus)
        if (worked && att) {
            // Holiday Work Bonus
            if (isHoliday) {
                // Holiday Work: +300% on top of Base
                const holidayBonus = Math.floor((att.workHours || 0) * hourlyRate * 3.0);
                holidayWorkPayTotal += holidayBonus;
                totalHolidayWorkHours += (att.workHours || 0);

                if (att.overtime && att.overtime > 0) {
                    const holidayOtBonus = Math.floor(att.overtime * hourlyRate * 3.0);
                    holidayWorkPayTotal += holidayOtBonus;
                    totalHolidayWorkHours += att.overtime;
                }
            } else {
                // Normal Overtime
                if (att.overtime && att.overtime > 0) {
                    const otMultiplier = BUSINESS_RULES.MULTIPLIERS.OVERTIME_DAY;
                    const otAmount = Math.floor(att.overtime * hourlyRate * otMultiplier);
                    overtimePayTotal += otAmount;
                    totalOvertimeHours += att.overtime;
                }
            }

            // Commission / Incentive
            if (staff.role === 'THERAPIST' && att.perfHours > 0) {
                commissionTotal += Math.floor(att.perfHours * (staff.commissionRate || 0));
                totalPerfHours += att.perfHours;
            }

            // Reception Commission (formerly Incentive)
            if (staff.role === 'RECEPTION' && att.perfReviews > 0) {
                commissionTotal += Math.floor(att.perfReviews * (staff.commissionRate || 0));
                totalReviews += att.perfReviews;
            }
        }
    }

    // Apply Manual Adjustments + Fixed Allowances from Staff
    const adjComm = adjustment?.commission || 0;
    const adjInc = adjustment?.incentive || 0; // Legacy / Fallback
    const adjDed = adjustment?.deduction || 0;
    const adjBonus = adjustment?.bonus || 0;

    // New Fields: Staff Base + Adjustment
    const allowPos = (staff.allowancePosition || 0) + (adjustment?.allowancePosition || 0);
    const allowCommute = (staff.allowanceCommute || 0) + (adjustment?.allowanceCommute || 0);
    const allowCommunication = (staff.allowanceCommunication || 0) + (adjustment?.allowanceCommunication || 0);
    const allowMeal = (staff.allowanceMeal || 0) + (adjustment?.allowanceMeal || 0);
    const allowHousing = (staff.allowanceHousing || 0) + (adjustment?.allowanceHousing || 0);
    const allowLanguage = (staff.allowanceLanguage || 0) + (adjustment?.allowanceLanguage || 0);
    const allowOther = (staff.allowanceOther || 0) + (adjustment?.allowanceOther || 0);

    const fine = adjustment?.fine || 0;
    const taxRefund = adjustment?.taxRefund || 0; // Positive value added to Net

    const timelineComm = adjustment?.timelineCommission ?? 0;

    // If timelineComm is provided (> 0 or specifically passed), we use it. 
    // But usually we want it to REPLACE the attendance-based one if we are moving to automated.
    // However, for safety, I will use whichever is larger or just the timeline one if provided.
    // Decision: If timelineCommission is passed, use it.
    if (adjustment && typeof adjustment.timelineCommission === 'number') {
        commissionTotal = adjustment.timelineCommission;
    }

    commissionTotal += adjComm;

    // Total Allowances
    const totalAlloc = allowPos + allowCommute + allowCommunication + allowMeal + allowHousing + allowLanguage + allowOther;

    // Gross Salary
    // Included: Base, OT, Holiday, Commission, Bonus, All Allowances.
    // Excluded: Fine (Net deduction), Tax Refund (Net addition).
    const grossSalary = basePayTotal + overtimePayTotal + holidayWorkPayTotal + commissionTotal + adjBonus + totalAlloc - adjDed;

    // Insurance Calculation (SI/HI/UI)
    // 2026 Rule: Use "Insurance Base Salary" if available.
    // Rates: SI 8%, HI 1.5%, UI 1% => Total 10.5%

    // Determine Base
    // If insuranceBaseSalary is set > 0, use it. Otherwise fallback to BaseWage + Pos + Lang + Other (Legacy).
    const insuranceBase = staff.insuranceBaseSalary && staff.insuranceBaseSalary > 0
        ? staff.insuranceBaseSalary
        : (staff.baseWage + allowPos + allowLanguage + allowOther);

    // 14-Day Rule: If Paid Days <= 12, Insurance = 0.
    // (Note: "14 days of no salary" roughly implies working <= 12 days in standard month-ish, 
    // or specifically "Working Days + Paid Leave < 14"? 
    // Usually Insurance follows: "Work/Paid >= 14 days => Pay Insurance".
    // User said: "Unpaid >= 14 days (Actual <= 12) -> 0". 
    // So if totalPaidDays <= 12, 0.

    const insurance = { si: 0, hi: 0, ui: 0, tu: 0, total: 0 };

    if (totalPaidDays > 12) {
        insurance.si = Math.round(insuranceBase * 0.08); // 8%
        insurance.hi = Math.round(insuranceBase * 0.015); // 1.5%
        insurance.ui = Math.round(insuranceBase * 0.01); // 1%
        insurance.total = insurance.si + insurance.hi + insurance.ui;
    }

    // Tax Calculation
    const dependents = staff.dependents || 0;
    const dependentDeductionTotal = dependents * BUSINESS_RULES.PIT.DEPENDENT_DEDUCTION;

    // Tax Exemptions
    // Commute: Exempt
    // Communication: Exempt
    // Meal: Exempt up to 730,000
    // Housing: Taxable (subject to 15% cap rule normally, here treating as fully taxable for simplicity/safety unless specified)
    // Language: Taxable
    // Position: Taxable

    const mealExempt = Math.min(allowMeal, BUSINESS_RULES.PIT.MEAL_ALLOWANCE_EXEMPTION);
    const commuteExempt = allowCommute;
    const communicationExempt = allowCommunication;

    const totalTaxExempt = mealExempt + commuteExempt + communicationExempt;

    // Taxable Income = Gross - Insurance - Personal - Dependent - Exemptions
    const taxableIncome = Math.max(0, grossSalary - insurance.total - BUSINESS_RULES.PIT.PERSONAL_DEDUCTION - dependentDeductionTotal - totalTaxExempt);
    const pit = calculatePIT(taxableIncome);

    // Net Salary
    // Net = Gross - Insurance - PIT - Fine + Tax Refund
    const netSalary = grossSalary - insurance.total - pit - fine + taxRefund;

    return {
        dailyRate,
        hourlyRate,
        totalWorkDays: totalPaidDays,
        totalActualWorkDays,
        totalWorkHours,
        totalOvertimeHours,
        totalHolidayWorkHours,
        totalPerfHours,
        totalReviews,
        basePayTotal,
        overtimePayTotal,
        holidayWorkPayTotal,
        commissionTotal,
        incentiveTotal,
        bonus: adjBonus,
        deduction: adjDed,
        allowances: {
            position: allowPos,
            commute: allowCommute,
            communication: allowCommunication,
            meal: allowMeal,
            housing: allowHousing,
            language: allowLanguage,
            other: allowOther,
            total: totalAlloc
        },
        fine,
        taxRefund,
        grossSalary,
        insurance,
        taxableIncome,
        pit,
        netSalary
    };
}

// Helper: Check if date is a Vietnam Holiday (2026)
function isVietnamHoliday(date: Date): boolean {
    const d = date.getDate();
    const m = date.getMonth() + 1; // 1-12
    const y = date.getFullYear();

    if (y !== 2026) return false; // Basic support for 2026

    // 1. New Year: 1/1
    if (m === 1 && d === 1) return true;

    // 2. Tet: 2/16 - 2/20
    if (m === 2 && d >= 16 && d <= 20) return true;

    // 3. Hung Kings: 4/26 (Sun) -> 4/27 (Mon) observed
    if (m === 4 && d === 26) return true;
    if (m === 4 && d === 27) return true; // Compensation

    // 4. Liberation Day: 4/30
    if (m === 4 && d === 30) return true;

    // 5. Labor Day: 5/1
    if (m === 5 && d === 1) return true;

    // 6. National Day: 9/2 + 1 day (Assume 9/3)
    if (m === 9 && d === 2) return true;
    if (m === 9 && d === 3) return true;

    return false;
}
