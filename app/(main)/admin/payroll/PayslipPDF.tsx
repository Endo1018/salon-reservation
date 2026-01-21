'use client';

import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { calculateStaffPayroll, formatCurrencyVND } from '@/lib/payroll-engine';
import { Staff } from '@prisma/client';

// Register Noto Sans JP for Japanese/Vietnamese support
Font.register({
    family: 'NotoSansJP',
    src: 'https://fonts.gstatic.com/s/notosansjp/v52/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8_1v4_PzzJ.ttf'
});

const styles = StyleSheet.create({
    page: {
        padding: 30,
        fontFamily: 'NotoSansJP',
        fontSize: 9,
        color: '#333'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
        paddingBottom: 10
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 5
    },
    subTitle: {
        fontSize: 10,
        textAlign: 'center',
        color: '#666'
    },
    staffInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        backgroundColor: '#f8f9fa',
        padding: 10,
        borderRadius: 4
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        backgroundColor: '#333',
        color: '#fff',
        padding: 4,
        marginTop: 10,
        marginBottom: 5
    },
    row: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: '#eee',
        paddingVertical: 3,
        alignItems: 'center'
    },
    rowTotal: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#333',
        paddingVertical: 5,
        marginTop: 5,
        fontWeight: 'bold',
        backgroundColor: '#eee'
    },
    label: {
        width: '50%'
    },
    value: {
        width: '50%',
        textAlign: 'right'
    },
    summarySection: {
        marginTop: 20,
        padding: 10,
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 4
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 5
    },
    netPay: {
        fontSize: 14,
        fontWeight: 'bold',
        borderTopWidth: 2,
        borderTopColor: '#333',
        paddingTop: 5,
        marginTop: 5
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 30,
        right: 30,
        textAlign: 'center',
        fontSize: 8,
        color: '#999',
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingTop: 10
    }
});

interface PayslipProps {
    staff: Staff;
    payroll: ReturnType<typeof calculateStaffPayroll>;
    year: number;
    month: number;
}

export const PayslipDocument = ({ staff, payroll, year, month }: PayslipProps) => {
    const periodStr = `${month}/${year}`;
    const createdStr = format(new Date(), 'yyyy/MM/dd HH:mm');

    const formatVal = (num: number) => formatCurrencyVND(num).replace('₫', '').trim() + ' VND';

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={{ fontSize: 14, fontWeight: 'bold' }}>Lotus Spa</Text>
                        <Text>123 Spa Street, District 1, HCMC</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 16 }}>PAY SLIP / 給与明細書</Text>
                        <Text>Period (対象期間): {periodStr}</Text>
                        <Text>Issue Date (発行日): {createdStr}</Text>
                    </View>
                </View>

                {/* Staff Info */}
                <View style={styles.staffInfo}>
                    <View>
                        <Text>ID: {staff.id}</Text>
                        <Text>Name (氏名): {staff.name}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text>Role: {staff.role}</Text>
                        <Text>Standard Days: 26</Text>
                    </View>
                </View>

                {/* Content Layout: 2 Columns */}
                <View style={{ flexDirection: 'row', gap: 20 }}>
                    {/* Left Column: Earnings */}
                    <View style={{ flex: 1 }}>
                        <Text style={styles.sectionTitle}>EARNINGS (支給の部)</Text>

                        {/* Attendance */}
                        <View style={styles.row}>
                            <Text style={styles.label}>Work Days (出勤日数)</Text>
                            <Text style={styles.value}>{payroll.totalWorkDays} days</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Work Hours (実働時間)</Text>
                            <Text style={styles.value}>
                                {(() => {
                                    const decimalHours = payroll.totalWorkHours;
                                    const totalMinutes = Math.round(decimalHours * 60);
                                    const h = Math.floor(totalMinutes / 60);
                                    const m = totalMinutes % 60;
                                    return `${h}:${m.toString().padStart(2, '0')}`;
                                })()} h
                            </Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Base Wage (基本給)</Text>
                            <Text style={styles.value}>{formatVal(payroll.basePayTotal)}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Overtime (残業手当)</Text>
                            <Text style={styles.value}>{formatVal(payroll.overtimePayTotal)}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Holiday Work (休日出勤)</Text>
                            <Text style={styles.value}>{formatVal(payroll.holidayWorkPayTotal)}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Commission (歩合)</Text>
                            <Text style={styles.value}>{formatVal(payroll.commissionTotal)}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Bonus (賞与/調整)</Text>
                            <Text style={styles.value}>{formatVal(payroll.bonus)}</Text>
                        </View>

                        {/* Allowances */}
                        <Text style={{ ...styles.sectionTitle, marginTop: 10, fontSize: 10, backgroundColor: '#666' }}>ALLOWANCES (手当)</Text>

                        {(payroll.allowances.position > 0) && (
                            <View style={styles.row}>
                                <Text style={styles.label}>Position (役職)</Text>
                                <Text style={styles.value}>{formatVal(payroll.allowances.position)}</Text>
                            </View>
                        )}
                        {(payroll.allowances.commute > 0) && (
                            <View style={styles.row}>
                                <Text style={styles.label}>Commute (通勤)</Text>
                                <Text style={styles.value}>{formatVal(payroll.allowances.commute)}</Text>
                            </View>
                        )}
                        {(payroll.allowances.meal > 0) && (
                            <View style={styles.row}>
                                <Text style={styles.label}>Meal (食事)</Text>
                                <Text style={styles.value}>{formatVal(payroll.allowances.meal)}</Text>
                            </View>
                        )}
                        {(payroll.allowances.language > 0) && (
                            <View style={styles.row}>
                                <Text style={styles.label}>Language (語学)</Text>
                                <Text style={styles.value}>{formatVal(payroll.allowances.language)}</Text>
                            </View>
                        )}
                        <View style={styles.row}>
                            <Text style={styles.label}>Other Allowances (その他)</Text>
                            <Text style={styles.value}>{formatVal(payroll.allowances.total - payroll.allowances.position - payroll.allowances.commute - payroll.allowances.meal - payroll.allowances.language)}</Text>
                        </View>

                        <View style={styles.rowTotal}>
                            <Text style={styles.label}>GROSS INCOME (総支給額)</Text>
                            <Text style={styles.value}>{formatVal(payroll.grossSalary)}</Text>
                        </View>
                    </View>

                    {/* Right Column: Deductions */}
                    <View style={{ flex: 1 }}>
                        <Text style={styles.sectionTitle}>DEDUCTIONS (控除の部)</Text>

                        <View style={styles.row}>
                            <Text style={styles.label}>Social Ins (社会保険 8%)</Text>
                            <Text style={styles.value}>{formatVal(payroll.insurance.si)}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Health Ins (健康保険 1.5%)</Text>
                            <Text style={styles.value}>{formatVal(payroll.insurance.hi)}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Unempl Ins (失業保険 1%)</Text>
                            <Text style={styles.value}>{formatVal(payroll.insurance.ui)}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Union Fee (組合費)</Text>
                            <Text style={styles.value}>{formatVal(payroll.insurance.tu)}</Text>
                        </View>

                        <View style={{ marginTop: 10 }}></View>

                        <View style={styles.row}>
                            <Text style={styles.label}>PIT (個人所得税)</Text>
                            <Text style={styles.value}>{formatVal(payroll.pit)}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Fine/Penalty (罰金)</Text>
                            <Text style={styles.value}>{formatVal(payroll.fine)}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Other Deduction (その他控除)</Text>
                            <Text style={styles.value}>{formatVal(payroll.deduction)}</Text>
                        </View>

                        <View style={{ marginTop: 20 }}></View>

                        {(payroll.taxRefund > 0) && (
                            <View style={{ ...styles.row, borderBottomColor: '#aaa' }}>
                                <Text style={{ width: '50%', color: '#006400' }}>Tax Refund (還付金)</Text>
                                <Text style={{ width: '50%', textAlign: 'right', color: '#006400' }}>+{formatVal(payroll.taxRefund)}</Text>
                            </View>
                        )}

                        <View style={styles.rowTotal}>
                            <Text style={styles.label}>TOTAL DEDUCTIONS (控除計)</Text>
                            <Text style={styles.value}>{formatVal(payroll.insurance.total + payroll.pit + payroll.fine + payroll.deduction)}</Text>
                        </View>

                        <View style={styles.summarySection}>
                            <Text style={{ textAlign: 'center', fontSize: 11, fontWeight: 'bold', marginBottom: 5 }}>NET PAYMENT (差引支給額)</Text>
                            <Text style={{ textAlign: 'center', fontSize: 16, fontWeight: 'bold' }}>{formatVal(payroll.netSalary)}</Text>
                        </View>
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text>This is a computer-generated document. No signature is required. Questions? Contact HR.</Text>
                </View>
            </Page>
        </Document>
    );
};
