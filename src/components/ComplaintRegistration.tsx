import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FilePlus2,
  Save,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  AIAssessment,
  Bureau,
  CategoryConfig,
  Complaint,
  Institution,
  PriorityLevel,
  UserProfile,
} from '../db/types';

interface ComplaintRegistrationProps {
  actor: UserProfile;
  institutions: Institution[];
  bureaus: Bureau[];
  categories: CategoryConfig[];
  onRunPrecheck: (payload: {
    title: string;
    description: string;
    institutionId: string;
    category: string;
    affectedCount: number;
  }) => Promise<{
    assessment: AIAssessment;
    suspectedDuplicates: {
      targetComplaint: Complaint;
      similarityScore: number;
      matchReasons: string[];
    }[];
  }>;
  onSubmitComplaint: (payload: {
    title: string;
    description: string;
    category: string;
    subcategory: string;
    institutionId: string;
    bureauId: string;
    priority: PriorityLevel;
    sourceChannel: Complaint['sourceChannel'];
    complainantType: Complaint['complainantType'];
    affectedCount: number;
    attachmentName?: string;
  }) => Promise<{ complaint: Complaint; aiAssessment: AIAssessment }>;
  onOpenComplaint: (id: string) => void;
}

const DRAFT_STORAGE_KEY = 'aicte_hub_complaint_intake_draft_v1';

export const ComplaintRegistration: React.FC<ComplaintRegistrationProps> = ({
  actor,
  institutions,
  bureaus,
  categories,
  onRunPrecheck,
  onSubmitComplaint,
  onOpenComplaint,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [institutionSearch, setInstitutionSearch] = useState('');
  const [institutionId, setInstitutionId] = useState(institutions[0]?.id || 'INST-001');
  const [category, setCategory] = useState(categories[0]?.name || 'Student grievances');
  const [subcategory, setSubcategory] = useState(
    categories[0]?.subcategories[0] || 'Retention of Original Certificates / Fee Refund Delay'
  );
  const [bureauId, setBureauId] = useState(categories[0]?.defaultBureauId || 'BUR-GRIEVANCE');
  const [priority, setPriority] = useState<PriorityLevel>('High');
  const [sourceChannel, setSourceChannel] = useState<string>('National Grievance Portal (CPGRAMS)');
  const [complainantType, setComplainantType] = useState<string>('Student (Verified)');
  const [affectedCount, setAffectedCount] = useState(1);
  const [attachmentName, setAttachmentName] = useState('');

  // Precheck & Submission States
  const [precheckResult, setPrecheckResult] = useState<{
    assessment: AIAssessment;
    suspectedDuplicates: {
      targetComplaint: Complaint;
      similarityScore: number;
      matchReasons: string[];
    }[];
  } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [draftSavedNotice, setDraftSavedNotice] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] = useState<Complaint | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Restore saved draft if present
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.description) setDescription(parsed.description);
        if (parsed.institutionId) setInstitutionId(parsed.institutionId);
        if (parsed.category) setCategory(parsed.category);
        if (parsed.subcategory) setSubcategory(parsed.subcategory);
        if (parsed.priority) setPriority(parsed.priority);
        if (parsed.affectedCount) setAffectedCount(parsed.affectedCount);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const currentCategoryObj = categories.find((c) => c.name === category) || categories[0];
  const filteredInstitutions = institutions.filter((i) =>
    `${i.institutionCode} ${i.name} ${i.state} ${i.district}`
      .toLowerCase()
      .includes(institutionSearch.toLowerCase())
  );
  const selectedInst = institutions.find((i) => i.id === institutionId) || institutions[0];

  const handleSaveDraft = () => {
    try {
      localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          title,
          description,
          institutionId,
          category,
          subcategory,
          priority,
          affectedCount,
        })
      );
      setDraftSavedNotice(`Draft saved locally at ${new Date().toLocaleTimeString()}`);
    } catch {
      setDraftSavedNotice('Unable to save draft in browser storage.');
    }
  };

  const handleLoadVerifiedRecord = () => {
    setTitle('Withholding of Original Certificates & Delayed Tuition Fee Refund After Counseling Resignation');
    setDescription(
      'Nineteen first-year engineering students who withdrew admission prior to the official state counseling cutoff date report that the institution administration has retained original 10th and 12th mark sheets and delayed tuition fee refunds beyond the statutory 30-day mandate. Formal withdrawal acknowledgment receipts are attached.'
    );
    setInstitutionId('INST-001');
    setCategory('Student grievances');
    setSubcategory('Retention of Original Certificates / Fee Refund Delay');
    setBureauId('BUR-GRIEVANCE');
    setPriority('Critical');
    setAffectedCount(19);
    setAttachmentName('Withdrawal_Receipts_Verification_Batch_2026.pdf');
    setValidationError(null);
  };

  const handleRunAIAnalysis = async () => {
    if (title.trim().length < 5 || description.trim().length < 10) {
      setValidationError('Enter a complaint title and description before running the AI Pre-Intake Assessment.');
      return;
    }
    setValidationError(null);
    const res = await onRunPrecheck({
      title,
      description,
      institutionId,
      category,
      affectedCount,
    });
    setPrecheckResult(res);
  };

  const handleApplyAISuggestions = () => {
    if (!precheckResult) return;
    const { assessment } = precheckResult;
    setCategory(assessment.suggestedCategory);
    setSubcategory(assessment.suggestedSubcategory);
    setPriority(assessment.suggestedPriority);
    setBureauId(assessment.suggestedBureauId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (title.trim().length < 10) {
      setValidationError('Validation Error: Complaint title must be at least 10 characters.');
      return;
    }
    if (description.trim().length < 25) {
      setValidationError('Validation Error: Detailed description must be at least 25 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSubmitComplaint({
        title,
        description,
        category,
        subcategory,
        institutionId,
        bureauId,
        priority,
        sourceChannel,
        complainantType,
        affectedCount,
        attachmentName: attachmentName || undefined,
      });
      setSubmittedRecord(result.complaint);
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (err: any) {
      setValidationError(err.message || 'Complaint submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <p className="text-xs font-medium text-teal-800">
              Structured Institutional Intake · Automatic Reference Generation & Duplicate Screening
            </p>
            <h1 className="text-xl font-bold text-slate-900">
              Register Institutional Complaint Case
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleLoadVerifiedRecord}
              className="px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md"
            >
              Autofill Verified Incident Record
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
            >
              <Save className="w-3.5 h-3.5" />
              Save Intake Draft
            </button>
          </div>
        </div>

        {draftSavedNotice && (
          <div className="mt-3 p-2.5 bg-slate-100 border border-slate-300 rounded text-xs text-slate-700 font-mono">
            {draftSavedNotice}
          </div>
        )}

        {validationError && (
          <div role="alert" className="mt-4 p-3.5 bg-red-50 border border-red-300 rounded-md text-xs font-medium text-red-900">
            {validationError}
          </div>
        )}

        {submittedRecord && (
          <div
            role="status"
            className="mt-4 p-4 bg-emerald-50 border border-emerald-300 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="space-y-1 text-xs text-emerald-950">
              <div className="font-bold text-sm flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                Complaint Registered Successfully — Reference: <span className="font-mono">{submittedRecord.referenceNumber}</span>
              </div>
              <p>
                Persisted to database with initial lifecycle status <strong>{submittedRecord.status}</strong> and routed to{' '}
                <strong>{submittedRecord.bureauId}</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenComplaint(submittedRecord.id)}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md whitespace-nowrap shrink-0"
            >
              Open Case Detail & Timeline
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="pt-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form Column (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div>
              <label htmlFor="intake-title" className="block text-xs font-semibold text-slate-800 mb-1">
                Complaint Title / Core Subject *
              </label>
              <input
                id="intake-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Non-refund of tuition fee and retention of original certificates upon withdrawal"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div>
              <label htmlFor="intake-desc" className="block text-xs font-semibold text-slate-800 mb-1">
                Detailed Complaint Description & Chronology *
              </label>
              <textarea
                id="intake-desc"
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide specific dates, factual sequence of events, representations made to the institution, and documentary references (avoid unnecessary personal identifiers)..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="inst-search" className="block text-xs font-semibold text-slate-800 mb-1">
                  Filter Institution Directory
                </label>
                <input
                  id="inst-search"
                  type="search"
                  value={institutionSearch}
                  onChange={(e) => setInstitutionSearch(e.target.value)}
                  placeholder="Filter by code, name, or state..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label htmlFor="intake-institution" className="block text-xs font-semibold text-slate-800 mb-1">
                  Select Approved Technical Institution *
                </label>
                <select
                  id="intake-institution"
                  value={institutionId}
                  onChange={(e) => setInstitutionId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
                >
                  {filteredInstitutions.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.institutionCode} — {i.name} ({i.state})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedInst && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 font-mono">
                Institution ID: {selectedInst.institutionCode} · Type: {selectedInst.institutionType} · State: {selectedInst.state} · District: {selectedInst.district}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="intake-category" className="block text-xs font-semibold text-slate-800 mb-1">
                  Complaint Category (Regulatory Taxonomy) *
                </label>
                <select
                  id="intake-category"
                  value={category}
                  onChange={(e) => {
                    const newCat = e.target.value;
                    setCategory(newCat);
                    const found = categories.find((c) => c.name === newCat);
                    if (found) {
                      setSubcategory(found.subcategories[0] || '');
                      setBureauId(found.defaultBureauId);
                      setPriority(found.defaultPriority);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="intake-subcategory" className="block text-xs font-semibold text-slate-800 mb-1">
                  Subcategory *
                </label>
                <select
                  id="intake-subcategory"
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
                >
                  {(currentCategoryObj?.subcategories || []).map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="intake-bureau" className="block text-xs font-semibold text-slate-800 mb-1">
                  Designated Bureau / Cell *
                </label>
                <select
                  id="intake-bureau"
                  value={bureauId}
                  onChange={(e) => setBureauId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
                >
                  {bureaus.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} — {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="intake-priority" className="block text-xs font-semibold text-slate-800 mb-1">
                  Initial Priority Level *
                </label>
                <select
                  id="intake-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
                >
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="High">High Priority</option>
                  <option value="Critical">Critical Priority</option>
                </select>
              </div>

              <div>
                <label htmlFor="intake-affected" className="block text-xs font-semibold text-slate-800 mb-1">
                  Affected Persons Count *
                </label>
                <input
                  id="intake-affected"
                  type="number"
                  min={1}
                  max={5000}
                  value={affectedCount}
                  onChange={(e) => setAffectedCount(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="intake-channel" className="block text-xs font-semibold text-slate-800 mb-1">
                  Source Channel
                </label>
                <select
                  id="intake-channel"
                  value={sourceChannel}
                  onChange={(e) => setSourceChannel(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
                >
                  <option value="National Grievance Portal (CPGRAMS)">National Grievance Portal (CPGRAMS)</option>
                  <option value="AICTE Student Redressal Portal">AICTE Student Redressal Portal</option>
                  <option value="AICTE Toll-Free Student Helpline (1800-11-2233)">AICTE Toll-Free Student Helpline (1800-11-2233)</option>
                  <option value="State Directorate Regulatory Inspection">State Directorate Regulatory Inspection</option>
                </select>
              </div>

              <div>
                <label htmlFor="intake-complainant" className="block text-xs font-semibold text-slate-800 mb-1">
                  Complainant Classification
                </label>
                <select
                  id="intake-complainant"
                  value={complainantType}
                  onChange={(e) => setComplainantType(e.target.value as Complaint['complainantType'])}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
                >
                  <option value="Student (Anonymized)">Student (Anonymized)</option>
                  <option value="Faculty Member (Anonymized)">Faculty Member (Anonymized)</option>
                  <option value="Parent/Guardian">Parent/Guardian</option>
                  <option value="Institutional Audit Cell">Institutional Audit Cell</option>
                  <option value="Public Stakeholder">Public Stakeholder</option>
                </select>
              </div>

              <div>
                <label htmlFor="intake-attachment" className="block text-xs font-semibold text-slate-800 mb-1">
                  Supporting Document Reference
                </label>
                <input
                  id="intake-attachment"
                  type="text"
                  value={attachmentName}
                  onChange={(e) => setAttachmentName(e.target.value)}
                  placeholder="e.g. Fee_Receipt_Annexure.pdf"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Registering Complaint...' : 'Register Complaint & Generate Reference'}
              </button>
              <button
                type="button"
                onClick={handleRunAIAnalysis}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-md transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                Run AI Classification & Duplicate Pre-Check
              </button>
            </div>
          </div>

          {/* Right Column: Live AI Pre-Intake Assessment & Duplicate Screening (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">
                  Explainable AI Intake Pre-Screening
                </h2>
                <span className="text-[11px] font-mono text-teal-800">Human-Supervised</span>
              </div>
              <p className="text-xs text-slate-600">
                Evaluates narrative text to recommend category, priority, bureau jurisdiction, and detect duplicate institutional complaints prior to committing the record.
              </p>

              {!precheckResult ? (
                <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded bg-white">
                  Click <strong>"Run AI Classification & Duplicate Pre-Check"</strong> or <strong>"Autofill Verified Incident Record"</strong> to preview explainable recommendations.
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-white border border-slate-200 rounded space-y-1.5">
                    <div className="font-mono text-[11px] text-teal-700">
                      ENGINE: {precheckResult.assessment.engineMode} · CONFIDENCE: {precheckResult.assessment.confidenceScore}%
                    </div>
                    <div>
                      <strong>Recommended Category:</strong> {precheckResult.assessment.suggestedCategory}
                    </div>
                    <div>
                      <strong>Recommended Subcategory:</strong> {precheckResult.assessment.suggestedSubcategory}
                    </div>
                    <div>
                      <strong>Recommended Priority:</strong>{' '}
                      <span className="font-bold text-red-700">{precheckResult.assessment.suggestedPriority}</span>
                    </div>
                    <div>
                      <strong>Recommended Bureau:</strong> {precheckResult.assessment.suggestedBureauId}
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyAISuggestions}
                      className="mt-2 w-full py-1.5 px-3 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded"
                    >
                      Apply AI Recommendations to Intake Form
                    </button>
                  </div>

                  {/* Suspected Duplicate Matches */}
                  <div className="p-3 bg-white border border-slate-200 rounded space-y-2">
                    <div className="font-bold text-slate-900">
                      Duplicate & Related Case Check ({precheckResult.suspectedDuplicates.length} found)
                    </div>
                    {precheckResult.suspectedDuplicates.length === 0 ? (
                      <p className="text-slate-500">No closely matching active complaints found for this institution.</p>
                    ) : (
                      precheckResult.suspectedDuplicates.map((dup) => (
                        <div key={dup.targetComplaint.id} className="p-2.5 bg-amber-50 border border-amber-200 rounded space-y-1">
                          <div className="flex items-center justify-between font-mono text-[11px] text-amber-900">
                            <span className="font-bold">{dup.targetComplaint.referenceNumber}</span>
                            <span>Similarity: {dup.similarityScore}%</span>
                          </div>
                          <div className="font-semibold text-slate-900">{dup.targetComplaint.title}</div>
                          <div className="text-[11px] text-slate-600">
                            Reasons: {dup.matchReasons.join(' · ')}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      </section>
    </div>
  );
};
