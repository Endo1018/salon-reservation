import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { Staff } from '@prisma/client';
import { formatCurrencyVND } from '@/lib/payroll-engine';

// Register a font that supports Vietnamese characters
// Using local fonts to avoid CORS/network issues with CDN
Font.register({
    family: 'Roboto',
    fonts: [
        { src: '/fonts/Roboto-Regular.ttf', fontWeight: 'normal' },
        { src: '/fonts/Roboto-Bold.ttf', fontWeight: 'bold' },
        { src: '/fonts/Roboto-Medium.ttf', fontWeight: 'medium' },
        { src: '/fonts/Roboto-Light.ttf', fontWeight: 'light' },
    ]
});

type PayrollData = {
    staff: Staff;
    totalWorkDays: number; // This is actually Total Paid Days in engine
    totalActualWorkDays: number;
    totalWorkHours: number;
    totalOvertimeHours: number;
    totalHolidayWorkHours: number;
    basePayTotal: number;
    overtimePayTotal: number;
    holidayWorkPayTotal: number;
    commissionTotal: number;
    incentiveTotal: number;
    bonus: number;
    deduction: number;
    allowances: {
        position: number;
        commute: number;
        communication: number;
        meal: number;
        housing: number;
        language: number;
        other: number;
        total: number;
    };
    fine: number;
    taxRefund: number;
    grossSalary: number;
    insurance: {
        si: number;
        hi: number;
        ui: number;
        total: number;
    };
    pit: number;
    netSalary: number;
};

type Props = {
    data: PayrollData;
    year: number;
    month: number;
};

// Create styles
const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        fontFamily: 'Roboto',
        padding: 30,
        fontSize: 10,
        color: '#000000',
    },
    header: {
        marginBottom: 20,
        textAlign: 'center',
    },
    companyName: {
        fontSize: 16,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    subHeader: {
        fontSize: 12,
        marginBottom: 2,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 10,
        marginBottom: 10,
        textDecoration: 'underline',
    },
    staffInfo: {
        marginBottom: 15,
        borderBottom: 1,
        borderColor: '#CCCCCC',
        paddingBottom: 10,
    },
    row: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    label: {
        width: 120,
        fontWeight: 'bold',
    },
    value: {
        flex: 1,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 10,
        marginBottom: 5,
        backgroundColor: '#EEEEEE',
        padding: 4,
    },
    table: {
        width: '100%',
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: '#000000',
        marginBottom: 10,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        borderStyle: 'solid',
        alignItems: 'center',
        minHeight: 20,
    },
    tableHeader: {
        backgroundColor: '#DDDDDD',
        fontWeight: 'bold',
    },
    tableColLabel: {
        width: '50%',
        borderRightWidth: 1,
        borderRightColor: '#000000',
        padding: 4,
    },
    tableColValue: {
        width: '50%',
        padding: 4,
        textAlign: 'right',
    },
    // Amounts section
    amountSection: {
        marginTop: 10,
    },
    amountRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 2,
        paddingHorizontal: 4,
    },
    amountRowTotal: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 2,
        marginBottom: 5,
        borderTopWidth: 1,
        borderColor: '#000000',
        paddingTop: 2,
        paddingHorizontal: 4,
        fontWeight: 'bold',
    },
    netPaySection: {
        marginTop: 20,
        padding: 10,
        borderWidth: 2,
        borderColor: '#000000',
        alignItems: 'center',
    },
    netPayLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    netPayValue: {
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 5,
    },
    footer: {
        marginTop: 40,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    signatureBlock: {
        width: '40%',
        alignItems: 'center',
    },
    signatureLine: {
        marginTop: 50,
        borderTopWidth: 1,
        borderTopColor: '#000000',
        width: '80%',
    },
});

export const PayslipDocument = ({ data, year, month }: Props) => {
    const { staff } = data;

    // A. TỔNG LƯƠNG (Total Salary) components
    // Base Wage (Salary for worked days) + Overtime + Holiday + Holiday OT
    const totalSalary = data.basePayTotal + data.overtimePayTotal + data.holidayWorkPayTotal;

    // B. TỔNG PHỤ CẤP (Total Allowances) components
    // Position + Commute + Meal + Housing + Language + Other + Commission + Bonus
    const totalAllowances = data.allowances.total + data.commissionTotal + data.bonus;

    // C. TỔNG KHẤU TRỪ (Total Deductions)
    // Insurance + PIT + Fine + Other Deductions
    const totalDeductions = data.insurance.total + data.pit + data.fine + data.deduction;

    // Re-verify Net Salary match
    // Theoretically: A + B - C + TaxRefund
    // Engine Net: Gross - Insurance - PIT - Fine + TaxRefund
    // Gross = Base + OT + Holiday + Commission + Bonus + Alloc - Ded
    // A + B - C + TaxRefund = (Base+OT+Hol) + (Alloc+Comm+Bonus) - (Ins+PIT+Fine+Ded) + Refund
    // = Base+OT+Hol+Alloc+Comm+Bonus-Ded - Ins - PIT - Fine + Refund
    // = Gross - Ins - PIT - Fine + Refund
    // Matches perfectly.

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.companyName}>CÔNG TY TNHH TFT ENTERTAINMENT</Text>
                    <Text>PHIẾU LƯƠNG / PAYSLIP</Text>
                    <Text style={styles.title}>{`THÁNG ${month} / ${year}`}</Text>
                </View>

                {/* Staff Info */}
                <View style={styles.staffInfo}>
                    <View style={styles.row}>
                        <Text style={styles.label}>ID:</Text>
                        <Text style={styles.value}>{staff.id}</Text>
                        <Text style={styles.label}>Họ tên / Name:</Text>
                        <Text style={styles.value}>{staff.name}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Chức vụ / Role:</Text>
                        <Text style={styles.value}>{staff.role}</Text>
                        <Text style={styles.label}>Mức lương / Base:</Text>
                        <Text style={styles.value}>{formatCurrencyVND(staff.baseWage)}</Text>
                    </View>
                </View>

                {/* WORK DETAILS */}
                <Text style={styles.sectionTitle}>I. CHI TIẾT NGÀY CÔNG / WORK DETAILS</Text>
                <View style={styles.table}>
                    <View style={[styles.tableRow, styles.tableHeader]}>
                        <Text style={styles.tableColLabel}>Hạng mục / Item</Text>
                        <Text style={styles.tableColValue}>Số lượng / Qty</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={styles.tableColLabel}>Ngày công thực tế (Actual Work Days)</Text>
                        <Text style={styles.tableColValue}>{data.totalActualWorkDays} days</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={styles.tableColLabel}>Giờ làm việc (Work Hours)</Text>
                        <Text style={styles.tableColValue}>{data.totalWorkHours.toFixed(1)} hours</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={styles.tableColLabel}>Tăng ca (Overtime)</Text>
                        <Text style={styles.tableColValue}>{data.totalOvertimeHours.toFixed(1)} hours</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={styles.tableColLabel}>Làm ngày lễ (Holiday Work)</Text>
                        <Text style={styles.tableColValue}>{data.totalHolidayWorkHours.toFixed(1)} hours</Text>
                    </View>
                </View>

                {/* INCOME DETAILS */}
                <Text style={styles.sectionTitle}>II. CHI TIẾT LƯƠNG / INCOME DETAILS</Text>

                {/* A. TOTAL SALARY */}
                <View style={styles.amountSection}>
                    <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>A. TỔNG LƯƠNG / TOTAL SALARY</Text>
                    <View style={styles.amountRow}>
                        <Text>Lương cơ bản (Base Pay)</Text>
                        <Text>{formatCurrencyVND(data.basePayTotal)}</Text>
                    </View>
                    <View style={styles.amountRow}>
                        <Text>Lương tăng ca (Overtime Pay)</Text>
                        <Text>{formatCurrencyVND(data.overtimePayTotal)}</Text>
                    </View>
                    <View style={styles.amountRow}>
                        <Text>Lương ngày lễ (Holiday Pay)</Text>
                        <Text>{formatCurrencyVND(data.holidayWorkPayTotal)}</Text>
                    </View>
                    <View style={styles.amountRowTotal}>
                        <Text>Tổng A (Total A)</Text>
                        <Text>{formatCurrencyVND(totalSalary)}</Text>
                    </View>
                </View>

                {/* B. TOTAL ALLOWANCES */}
                <View style={styles.amountSection}>
                    <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>B. TỔNG PHỤ CẤP / TOTAL ALLOWANCES</Text>
                    <View style={styles.amountRow}>
                        <Text>Phụ cấp chức vụ (Position)</Text>
                        <Text>{formatCurrencyVND(data.allowances.position)}</Text>
                    </View>
                    <View style={styles.amountRow}>
                        <Text>Phụ cấp đi lại (Commute)</Text>
                        <Text>{formatCurrencyVND(data.allowances.commute)}</Text>
                    </View>
                    <View style={styles.amountRow}>
                        <Text>Phụ cấp ăn trưa (Meal)</Text>
                        <Text>{formatCurrencyVND(data.allowances.meal)}</Text>
                    </View>
                    <View style={styles.amountRow}>
                        <Text>Phụ cấp nhà ở (Housing)</Text>
                        <Text>{formatCurrencyVND(data.allowances.housing)}</Text>
                    </View>
                    <View style={styles.amountRow}>
                        <Text>Phụ cấp ngoại ngữ (Language)</Text>
                        <Text>{formatCurrencyVND(data.allowances.language)}</Text>
                    </View>
                    <View style={styles.amountRow}>
                        <Text>Phụ cấp khác (Other)</Text>
                        <Text>{formatCurrencyVND(data.allowances.other)}</Text>
                    </View>
                    <View style={styles.amountRow}>
                        <Text>Hoa hồng (Commission)</Text>
                        <Text>{formatCurrencyVND(data.commissionTotal)}</Text>
                    </View>
                    <View style={styles.amountRow}>
                        <Text>Thưởng (Bonus)</Text>
                        <Text>{formatCurrencyVND(data.bonus)}</Text>
                    </View>
                    <View style={styles.amountRowTotal}>
                        <Text>Tổng B (Total B)</Text>
                        <Text>{formatCurrencyVND(totalAllowances)}</Text>
                    </View>
                </View>

                {/* C. TOTAL DEDUCTIONS */}
                <View style={styles.amountSection}>
                    <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>C. TỔNG KHẤU TRỪ / TOTAL DEDUCTIONS</Text>
                    <View style={styles.amountRow}>
                        <Text>Bảo hiểm (Insurance 10.5%)</Text>
                        <Text>{formatCurrencyVND(data.insurance.total)}</Text>
                    </View>
                    <View style={styles.amountRow}>
                        <Text>Thuế TNCN (PIT)</Text>
                        <Text>{formatCurrencyVND(data.pit)}</Text>
                    </View>
                    <View style={styles.amountRow}>
                        <Text>Phạt (Fine)</Text>
                        <Text>{formatCurrencyVND(data.fine)}</Text>
                    </View>
                    <View style={styles.amountRow}>
                        <Text>Khấu trừ khác (Other Ded.)</Text>
                        <Text>{formatCurrencyVND(data.deduction)}</Text>
                    </View>
                    <View style={styles.amountRowTotal}>
                        <Text>Tổng C (Total C)</Text>
                        <Text>{formatCurrencyVND(totalDeductions)}</Text>
                    </View>
                </View>

                {/* Tax Refund if any */}
                {data.taxRefund > 0 && (
                    <View style={styles.amountSection}>
                        <View style={styles.amountRow}>
                            <Text>Hoàn thuế (Tax Refund)</Text>
                            <Text>{formatCurrencyVND(data.taxRefund)}</Text>
                        </View>
                    </View>
                )}


                {/* NET PAY */}
                <View style={styles.netPaySection}>
                    <Text style={styles.netPayLabel}>TỔNG THỰC NHẬN / NET PAYMENT</Text>
                    <Text style={styles.netPayValue}>{formatCurrencyVND(data.netSalary)}</Text>
                    <Text style={{ fontSize: 10, marginTop: 5, fontStyle: 'italic' }}>[ A + B - C {data.taxRefund > 0 ? '+ Refund' : ''} ]</Text>
                </View>

                {/* FOOTER */}
                <View style={styles.footer}>
                    <View style={styles.signatureBlock}>
                        <Text>Người lập biểu</Text>
                        <Text>(Prepared by)</Text>
                        <View style={styles.signatureLine} />
                    </View>
                    <View style={styles.signatureBlock}>
                        <Text>Người nhận</Text>
                        <Text>(Receiver)</Text>
                        <Text style={{ fontSize: 8, fontStyle: 'italic', marginTop: 2 }}>(Ký và ghi rõ họ tên)</Text>
                        <View style={styles.signatureLine} />
                    </View>
                </View>

                <Text style={{ position: 'absolute', bottom: 20, left: 30, fontSize: 8, color: '#999' }}>
                    Generated by SPA System on {new Date().toLocaleDateString('vi-VN')}
                </Text>

            </Page>
        </Document>
    );
};
