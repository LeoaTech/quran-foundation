import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Modal from '../../../../components/Modal';
import Button from '../../../../components/Button';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import { useToast } from '../../../../hooks/useToast';
import client from '../../../../api/client';
import { Card, CardHeader, CardBody } from '../../../../components/Card';


// 1. Mock session schedules with corresponding topics taught
const MOCK_SESSIONS = [
    { index: 1, date: '2026-06-06', day_of_week: 'Saturday', topic: 'Surah Al-Fatiha', topic_ur: 'سورۃ الفاتحہ' },
    { index: 2, date: '2026-06-08', day_of_week: 'Monday', topic: 'Surah Al-Kahaf', topic_ur: 'سورۃ الکہف' },
    { index: 3, date: '2026-06-13', day_of_week: 'Saturday', topic: 'Surah Al-Baqrah', topic_ur: 'سورۃ البقرہ' },
    { index: 4, date: '2026-06-15', day_of_week: 'Monday', topic: 'Noon Sakinah & Tanween', topic_ur: 'نون ساکنہ اور تنوین' },
];

// 2. Initial state pre-populated with cumulative homework criteria matching center templates
const INITIAL_CRITERIA_MAP = {
    1: {
        label: 'Fatiha Makharij Evaluation',
        items: [
            { topic: 'Surah Al-Fatiha', description: 'Makhrij checking for verses 1 to 4 with focus on Ayn and Zaad.', marks: 10 }
        ]
    },
    2: {
        label: 'Kahaf Intro & Fatiha Review',
        items: [
            { topic: 'Surah Al-Kahaf', description: 'Recitation practice of verses 1 to 5 checking Madd rules.', marks: 10 },
            { topic: 'Surah Al-Fatiha', description: 'Review verification of Surah Al-Fatiha verse 5 and 6.', marks: 5 }
        ]
    }
};

export default function HomeworkCriteriaTab({ cls }) {
    const [criteriaMap, setCriteriaMap] = useState(INITIAL_CRITERIA_MAP);
    const [editingSessionIndex, setEditingSessionIndex] = useState(null);

    // Temporary state holding form values while editing
    const [editLabel, setEditLabel] = useState('');
    const [editItems, setEditItems] = useState([]);

    // Find currently editing session details
    const activeSession = MOCK_SESSIONS.find(s => s.index === editingSessionIndex);

    // Determine eligible topics: current session topic + all preceding session topics
    const eligibleSessions = activeSession
        ? MOCK_SESSIONS.filter(s => s.index <= activeSession.index)
        : [];

    // Initialize the editor form when editing starts
    const handleEditClick = (sessionIndex) => {
        setEditingSessionIndex(sessionIndex);
        const existing = criteriaMap[sessionIndex];
        if (existing) {
            setEditLabel(existing.label || '');
            setEditItems(existing.items ? [...existing.items] : []);
        } else {
            const sess = MOCK_SESSIONS.find(s => s.index === sessionIndex);
            setEditLabel('');
            // Pre-add one empty item with the current topic as default
            setEditItems([
                { topic: sess ? sess.topic : '', description: '', marks: 10 }
            ]);
        }
    };

    // Add an additional criteria sub-form rule to the editing session
    const handleAddCriteriaItem = () => {
        setEditItems(prev => [
            ...prev,
            { topic: activeSession ? activeSession.topic : '', description: '', marks: 10 }
        ]);
    };

    const handleRemoveCriteriaItem = (indexToRemove) => {
        setEditItems(prev => prev.filter((_, idx) => idx !== indexToRemove));
    };

    const handleItemChange = (index, field, value) => {
        setEditItems(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                [field]: field === 'marks' ? Number(value) : value
            };
            return updated;
        });
    };

    // Calculate total marks by summing all criteria sub-items
    const calculateTotalMarks = (items) => {
        return items.reduce((sum, item) => sum + Number(item.marks || 0), 0);
    };

    const handleSaveAll = (e) => {
        e.preventDefault();
        if (!editLabel.trim()) return;

        // Filter out invalid or blank items
        const cleanedItems = editItems.filter(item => item.topic && item.description.trim());

        setCriteriaMap(prev => ({
            ...prev,
            [editingSessionIndex]: {
                label: editLabel,
                items: cleanedItems
            }
        }));

        setEditingSessionIndex(null);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* ── All Class Sessions List Table ── */}
            <div className="card" style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>

                <div className="cbf">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--sand-light)' }}>
                                {['#', 'Session Date', 'Topic Taught', 'Homework Label', 'Homework Criteria Items', 'Total Marks', 'Action'].map((h, i) => (
                                    <th key={i} style={styles.th}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {MOCK_SESSIONS.map((sess) => {
                                const criteria = criteriaMap[sess.index];
                                const totalMarks = criteria ? calculateTotalMarks(criteria.items) : 0;
                                const isEditing = editingSessionIndex === sess.index;

                                return (
                                    <tr key={sess.index} style={{
                                        borderBottom: '1px solid var(--sand)',
                                        background: isEditing ? 'var(--primary-l)' : 'none'
                                    }}>
                                        <td style={styles.td}><strong>{sess.index}</strong></td>
                                        <td style={styles.td}>
                                            <div style={{ fontWeight: 600 }}>
                                                {new Date(sess.date + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--ink-pale)' }}>{sess.day_of_week}</div>
                                        </td>
                                        <td style={styles.td}>
                                            <span className="badge bg-teal" style={styles.badgeTeal}>{sess.topic}</span>
                                        </td>
                                        <td style={styles.td}>
                                            {criteria ? (
                                                <span style={{ fontWeight: 500 }}>{criteria.label}</span>
                                            ) : (
                                                <span style={{ color: 'var(--ink-pale)', fontStyle: 'italic' }}>Not configured</span>
                                            )}
                                        </td>
                                        <td style={styles.td}>
                                            {criteria && criteria.items?.length > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    {criteria.items.map((item, idx) => (
                                                        <div key={idx} style={{ fontSize: 11, color: 'var(--ink-mid)' }}>
                                                            • <strong>{item.topic}</strong>: {item.marks} marks
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span style={{ color: 'var(--ink-pale)' }}>—</span>
                                            )}
                                        </td>
                                        <td style={styles.td}>
                                            {criteria ? (
                                                <span className="badge bg-green" style={{ background: '#d1fae5', color: '#065f46', fontWeight: 700 }}>
                                                    {totalMarks} Marks
                                                </span>
                                            ) : (
                                                <span style={{ color: 'var(--ink-pale)' }}>—</span>
                                            )}
                                        </td>
                                        <td style={{ ...styles.td, textAlign: 'right' }}>
                                            <Button size="sm" variant={criteria ? 'outline' : 'primary'} onClick={() => handleEditClick(sess.index)}>
                                                {criteria ? 'Edit Criteria' : '+ Add Criteria'}
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Standard Centered Modal Form ── */}
            <Modal
                open={editingSessionIndex !== null}
                onClose={() => setEditingSessionIndex(null)}
                title={activeSession ? `Configure Criteria — Session ${editingSessionIndex}` : ''}
                size="md"
            >
                {activeSession && (
                    <div style={styles.modalContentWrapper}>
                        <div style={styles.sessionSubtitle}>
                            Class Topic: {activeSession.topic} · Allowed Scope: Current & Past Topics
                        </div>

                        <form onSubmit={handleSaveAll} style={{ width: '100%' }}>

                            {/* Criteria Label Input */}
                            <div className="f-group" style={{ marginBottom: 20 }}>
                                <label className="f-label" style={{ textAlign: 'left', display: 'block' }}>Homework Session Label / Name</label>
                                <input
                                    type="text"
                                    className="f-input"
                                    style={styles.modalInput}
                                    placeholder="e.g. Assessment 3A, Tajweed Makharij Test"
                                    value={editLabel}
                                    onChange={(e) => setEditLabel(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Dynamic Rules Segment */}
                            <div style={styles.rulesDivider}>
                                <div style={styles.criteriaFields}>
                                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-mid)' }}>Criteria Rules Checklist</span>
                                    <Button type="button" size="sm" variant="primary" style={{ color: 'white', borderColor: 'var(--outline)' }} onClick={handleAddCriteriaItem}>
                                        + Add Criteria Rule
                                    </Button>
                                </div>

                                {/* Sub-criteria inputs array wrapper */}
                                <div style={styles.scrollableCriteriaContainer}>
                                    {editItems.map((item, idx) => (
                                        <div key={idx} style={styles.criteriaItemRow}>
                                            <div style={styles.criteriaHeader}>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary-h)' }}>Rule #{idx + 1}</span>
                                                {editItems.length > 1 && (
                                                    <button type="button" style={styles.removeBtn} onClick={() => handleRemoveCriteriaItem(idx)}>
                                                        Remove
                                                    </button>
                                                )}
                                            </div>

                                            {/* Dropdown & Marks Side-by-Side */}
                                            <div style={styles.criteriaFields}>
                                                <div style={styles.criteriaField}>
                                                    <label style={styles.criteriaLabel}>Evaluate Topic</label>
                                                    <select
                                                        className="fc"
                                                        style={{ padding: '6px 10px', fontSize: 12, height: '34px', width: "100%" }}
                                                        value={item.topic}
                                                        onChange={(e) => handleItemChange(idx, 'topic', e.target.value)}
                                                        required
                                                    >
                                                        <option value="">-- Choose Topic --</option>
                                                        {eligibleSessions.map(es => (
                                                            <option key={es.index} value={es.topic}>
                                                                Session {es.index} Topic — {es.topic} {es.index === activeSession.index ? '(Current)' : '(Previous)'}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div style={styles.criteriaField}>
                                                    <label style={styles.criteriaLabel}>Max Marks</label>
                                                    <input
                                                        type="number"
                                                        className="fc"
                                                        style={{ padding: '6px 10px', fontSize: 12, height: '34px', width: "100%", textAlign: 'center' }}
                                                        min="1"
                                                        value={item.marks}
                                                        onChange={(e) => handleItemChange(idx, 'marks', e.target.value)}
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            {/* Scope description Textarea */}
                                            <div style={styles.criteriaField}>
                                                <label style={styles.criteriaLabel}>Homework Instructions / Description</label>
                                                <textarea
                                                    className="fc"
                                                    style={{ height: 48, fontSize: 12, padding: '8px 10px', width: "100%", fontFamily: 'inherit', resize: 'none' }}
                                                    placeholder="Define evaluation metrics, scope of checking, etc..."
                                                    value={item.description}
                                                    onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                                    required
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Summary and Centered Actions */}
                            <div style={styles.modalFooter}>
                                <div style={styles.totalCalculatedText}>
                                    Total Marks: <span style={styles.totalBadge}>{calculateTotalMarks(editItems)} Marks</span>
                                </div>

                                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingSessionIndex(null)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" size="sm" variant="primary">
                                        Save Session Criteria
                                    </Button>
                                </div>
                            </div>

                        </form>
                    </div>
                )}
            </Modal>
        </div>
    );
}

const styles = {
    th: {
        textAlign: 'left',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--ink-pale)',
        textTransform: 'uppercase',
        padding: '12px 14px',
        borderBottom: '1.5px solid var(--sand-mid)'
    },
    td: {
        padding: '14px',
        fontSize: 13,
        color: 'var(--ink)',
        verticalAlign: 'middle'
    },
    badgeTeal: {
        background: '#ccfbf1',
        color: '#0d9488',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: 11,
        fontWeight: 500
    },
    // Centering & Width Limiting Styles for Non-Responsive Form elements inside Modal
    modalContentWrapper: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: '520px',
        margin: '0 auto',
        padding: '0 8px',
    },
    sessionSubtitle: {
        fontSize: 12,
        color: 'var(--ink-pale)',
        marginTop: -12,
        marginBottom: 20,
        textAlign: 'center'
    },
    modalInput: {
        width: '100%',
        maxWidth: '520px',
        margin: '0 auto',
    },
    rulesDivider: {
        borderTop: '1px solid var(--sand-mid)',
        paddingTop: '14px',
        marginTop: 12,
        width: '100%',
        maxWidth: '520px'
    },
    scrollableCriteriaContainer: {
        maxHeight: '260px',
        overflowY: 'auto',
        paddingRight: '4px',
        marginBottom: 10,
    },
    criteriaFields: {
        display: 'flex',
        justifyContent: "space-between",
        alignItems: "center",
        flexDirection: 'row',
        gap: 12,
        marginBottom: 10,
        width: '100%',
    },
    criteriaLabel: {
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--ink-mid)',
        textAlign: 'left',
    },
    criteriaHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    criteriaItemRow: {
        background: 'var(--sand-light)',
        border: '1px solid var(--sand-mid)',
        borderRadius: '8px',
        padding: '12px 14px',
        marginBottom: 12,
    },
    removeBtn: {
        background: 'none',
        border: 'none',
        color: 'var(--red)',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer'
    },
    modalFooter: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        marginTop: 20,
        paddingTop: 16,
        borderTop: '2px solid var(--sand-mid)',
        width: '100%',
        maxWidth: '520px'
    },
    totalCalculatedText: {
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--ink-mid)',
        textAlign: 'center'
    },
    totalBadge: {
        background: '#d1fae5',
        color: '#065f46',
        padding: '4px 10px',
        borderRadius: '6px',
        marginLeft: 6,
        fontSize: 12
    }
};