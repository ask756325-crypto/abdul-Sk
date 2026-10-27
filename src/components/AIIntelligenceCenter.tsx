import React, { useState } from 'react';
import {
  CheckCircle2,
  GitBranch,
  HelpCircle,
  MessageSquare,
  Send,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import {
  AIAssessment,
  AIFeedbackEntry,
  Bureau,
  Complaint,
  ComplaintRelationship,
  ComplaintStatus,
  Institution,
  PriorityConfig,
  PriorityLevel,
} from '../db/types';
import { answerOperationalQuery } from '../db/rules';

interface AIIntelligenceCenterProps {
  aiEngineLabel: string;
  complaints: Complaint[];
  bureaus: Bureau[];
  institutions: Institution[];
  priorities: PriorityConfig[];
  relationships: ComplaintRelationship[];
  aiAssessments: Record<string, AIAssessment>;
  aiFeedback: AIFeedbackEntry[];
  onDecideDuplicate: (relId: string, status: 'CONFIRMED' | 'DISMISSED') => Promise<void>;
  onRecordAIFeedback: (
    complaintId: string,
    decision: 'ACCEPTED' | 'MODIFIED' | 'REJECTED',
    notes: string
  ) => Promise<void>;
  onOpenComplaint: (id: string) => void;
}

const PRESET_QUESTIONS = [
  'Which bureau has the largest pending backlog?',
  'Which cases have exceeded their configured targets?',
  'What are the most common complaint categories this month?',
  'Which cases need an officer’s attention first?',
  'How has resolution performance changed over the selected period?',
];

export const AIIntelligenceCenter: React.FC<AIIntelligenceCenterProps> = ({
  aiEngineLabel,
  complaints,
  bureaus,
  institutions,
  priorities,
  relationships,
  aiAssessments,
  aiFeedback,
  onDecideDuplicate,
  onRecordAIFeedback,
  onOpenComplaint,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'ASSISTANT' | 'DUPLICATES' | 'ASSESSMENTS'>('ASSISTANT');
  const [queryInput, setQueryInput] = useState(PRESET_QUESTIONS[0]);
  const [queryResponse, setQueryResponse] = useState(() =>
    answerOperationalQuery(PRESET_QUESTIONS[0], complaints, bureaus, institutions, priorities)
  );

  const handleAskQuestion = (qText: string) => {
    setQueryInput(qText);
    const res = answerOperationalQuery(qText, complaints, bureaus, institutions, priorities);
    setQueryResponse(res);
  };

  const assessmentList = Object.values(aiAssessments);
  const acceptedCount = assessmentList.filter((a) => a.humanReviewStatus === 'ACCEPTED').length;
  const pendingReviewCount = assessmentList.filter((a) => a.humanReviewStatus === 'PENDING_REVIEW').length;

  return (
    <div className="space-y-6">
      {/* Header & Sub-Navigation */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <p className="text-xs font-mono text-teal-800">
              ACTIVE ENGINE: {aiEngineLabel}
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5">
              Explainable AI Complaint Intelligence & Duplicate Network
            </h1>
            <p className="text-xs text-slate-600 mt-1 max-w-3xl">
              Every recommendation provides transparent factor weights, distinguishes reported allegations from verified facts, and requires human officer confirmation before administrative action.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-md border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSubTab('ASSISTANT')}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                activeSubTab === 'ASSISTANT' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Contextual Intelligence Assistant
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('DUPLICATES')}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                activeSubTab === 'DUPLICATES' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Duplicate Complaint Network ({relationships.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('ASSESSMENTS')}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                activeSubTab === 'ASSESSMENTS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Case AI Assessments ({assessmentList.length})
            </button>
          </div>
        </div>

        {/* Summary Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded">
            <div className="text-slate-500">Assessed Complaints</div>
            <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
              {assessmentList.length}
            </div>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded">
            <div className="text-slate-500">Human Officer Verified</div>
            <div className="text-lg font-bold font-mono tabular-nums text-emerald-700 mt-0.5">
              {acceptedCount} Accepted
            </div>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded">
            <div className="text-slate-500">Awaiting Officer Review</div>
            <div className="text-lg font-bold font-mono tabular-nums text-amber-700 mt-0.5">
              {pendingReviewCount} Pending
            </div>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded">
            <div className="text-slate-500">Duplicate / Linked Pairs</div>
            <div className="text-lg font-bold font-mono tabular-nums text-teal-800 mt-0.5">
              {relationships.length} Links
            </div>
          </div>
        </div>
      </section>

      {/* SUB-TAB 1: CONTEXTUAL COMPLAINT INTELLIGENCE ASSISTANT */}
      {activeSubTab === 'ASSISTANT' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">
              Query Authorized Stored Complaint Records
            </h2>
            <p className="text-xs text-slate-600">
              Select a benchmark SIH evaluation question or enter a custom operational query. Answers are computed strictly from authorized records in your role scope.
            </p>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700">Benchmark Judge Queries:</div>
              {PRESET_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleAskQuestion(q)}
                  className={`w-full text-left p-2.5 text-xs rounded border transition-colors ${
                    queryInput === q
                      ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskQuestion(queryInput);
              }}
              className="pt-2 space-y-2"
            >
              <label htmlFor="assistant-custom-input" className="block text-xs font-semibold text-slate-700">
                Custom Operational Query
              </label>
              <div className="flex gap-2">
                <input
                  id="assistant-custom-input"
                  type="text"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="Ask about backlog, overdue cases, categories, or resolution rate..."
                  className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md whitespace-nowrap"
                >
                  Run Query
                </button>
              </div>
            </form>
          </section>

          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <div className="text-xs font-mono text-teal-800">
                COMPUTED RESPONSE · {queryResponse.dataScopeNote}
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-1">
                {queryResponse.answerHeadline}
              </h2>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-800 mb-2">
                Supporting Database Evidence & Breakdown:
              </h3>
              <ul className="space-y-1.5 text-xs text-slate-700">
                {queryResponse.supportingFacts.map((fact, idx) => (
                  <li key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded font-mono">
                    {fact}
                  </li>
                ))}
              </ul>
            </div>

            {queryResponse.referencedCases.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-slate-800 mb-2">
                  Referenced Complaint Records (Click to Open):
                </h3>
                <div className="space-y-2">
                  {queryResponse.referencedCases.map((rc) => {
                    const full = complaints.find((c) => c.referenceNumber === rc.referenceNumber);
                    return (
                      <div
                        key={rc.referenceNumber}
                        className="p-3 bg-white border border-slate-200 rounded flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-mono font-bold text-slate-900">
                            {rc.referenceNumber} · {rc.priority} Priority · {rc.status}
                          </div>
                          <div className="text-xs text-slate-700 truncate">{rc.title}</div>
                        </div>
                        {full && (
                          <button
                            type="button"
                            onClick={() => onOpenComplaint(full.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded shrink-0"
                          >
                            Open Case
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* SUB-TAB 2: DUPLICATE COMPLAINT NETWORK & REVIEW QUEUE */}
      {activeSubTab === 'DUPLICATES' && (
        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Duplicate & Related Complaint Relationship Network
            </h2>
            <p className="text-xs text-slate-500">
              Detects related complaints across identical institutions, categories, lexical overlap, and submission windows. Human officer confirmation is required before linking.
            </p>
          </div>

          <div className="space-y-3">
            {relationships.map((rel) => {
              const src = complaints.find((c) => c.id === rel.sourceComplaintId);
              const tgt = complaints.find((c) => c.id === rel.targetComplaintId);
              return (
                <div key={rel.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                    <span className="font-bold text-slate-900">
                      {src?.referenceNumber || rel.sourceComplaintId} ⇄ {tgt?.referenceNumber || rel.targetComplaintId}
                    </span>
                    <span
                      className={`font-semibold ${
                        rel.status === 'CONFIRMED'
                          ? 'text-emerald-700'
                          : rel.status === 'DISMISSED'
                          ? 'text-slate-500'
                          : 'text-amber-700'
                      }`}
                    >
                      Similarity: {rel.similarityScore}% · Type: {rel.relationshipType} · Status: {rel.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-white border border-slate-200 rounded">
                      <div className="font-mono text-slate-500">Source Case ({src?.referenceNumber})</div>
                      <div className="font-semibold text-slate-900 mt-0.5">{src?.title}</div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {src?.institutionName} · {src?.status}
                      </div>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded">
                      <div className="font-mono text-slate-500">Target Case ({tgt?.referenceNumber})</div>
                      <div className="font-semibold text-slate-900 mt-0.5">{tgt?.title}</div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {tgt?.institutionName} · {tgt?.status}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-700">
                    <strong>Algorithmic Match Signals:</strong> {rel.matchReasons.join(' · ')}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                    <div className="text-[11px] text-slate-500 font-mono">
                      {rel.confirmedByName
                        ? `Verified by ${rel.confirmedByName} at ${rel.confirmedAt?.slice(0, 16)}`
                        : 'Awaiting authorized human officer confirmation'}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onDecideDuplicate(rel.id, 'CONFIRMED')}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded"
                      >
                        Confirm Link
                      </button>
                      <button
                        type="button"
                        onClick={() => onDecideDuplicate(rel.id, 'DISMISSED')}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded"
                      >
                        Dismiss Match
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* SUB-TAB 3: EXPLAINABLE AI ASSESSMENTS TABLE */}
      {activeSubTab === 'ASSESSMENTS' && (
        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Explainable AI Case Assessments & Supervisory Review Queue
            </h2>
            <p className="text-xs text-slate-500">
              Review classification, priority factor weights, urgency signals, and record human supervisory approval.
            </p>
          </div>

          <div className="space-y-3">
            {complaints.slice(0, 8).map((c) => {
              const ai = aiAssessments[c.id];
              if (!ai) return null;
              return (
                <div key={c.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-mono font-bold text-slate-900">
                      {c.referenceNumber} · {c.institutionName}
                    </div>
                    <div className="font-mono text-teal-800">
                      Confidence: {ai.confidenceScore}% · Review: <strong>{ai.humanReviewStatus}</strong>
                    </div>
                  </div>
                  <div className="font-semibold text-slate-900">{c.title}</div>
                  <div className="text-slate-600">
                    <strong>Suggested Classification:</strong> {ai.suggestedCategory} ({ai.suggestedSubcategory}) ·{' '}
                    <strong>Suggested Priority:</strong> {ai.suggestedPriority} ·{' '}
                    <strong>Suggested Bureau:</strong> {ai.suggestedBureauId}
                  </div>
                  <div className="text-slate-700">
                    <strong>Executive Summary:</strong> {ai.executiveSummary.coreIssue}{' '}
                    {ai.executiveSummary.suggestedNextStep}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onRecordAIFeedback(c.id, 'ACCEPTED', 'Accepted via AI Intelligence Center review.')
                        }
                        className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onRecordAIFeedback(c.id, 'REJECTED', 'Overridden via AI Intelligence Center review.')
                        }
                        className="px-2.5 py-1 text-xs font-medium text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded"
                      >
                        Reject
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenComplaint(c.id)}
                      className="px-3 py-1 text-xs font-semibold text-teal-800 bg-white border border-slate-300 hover:bg-slate-100 rounded"
                    >
                      Inspect Full Case & AI Factors
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
