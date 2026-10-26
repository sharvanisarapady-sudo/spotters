import { useCallback, useEffect, useRef, useState } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { adminService } from '../services/adminService';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const STATUSES = ['draft', 'pending_review', 'approved', 'published'];

const errMsg = (err, fallback) => err.response?.data?.message || fallback;

function Banner({ kind = 'error', children }) {
  if (!children) return null;
  const style = kind === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700';
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`rounded-lg border text-sm px-4 py-3 ${style}`}>{children}</div>;
}
function CreateCaseForm({ onCreated, onCancel }) {
  const [systems, setSystems] = useState([]);
  const [loadingSystems, setLoadingSystems] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    system_id: '',
    modality: '',
    clinical_info: '',
    question_text: '',
    correct_answer: '',
    explanation: '',
    key_findings: '',
    learning_points: '',
    differential_diagnosis: '',
    difficulty: 'medium',
  });

  useEffect(() => {
    adminService.listSystems()
      .then((r) => setSystems(r.systems || []))
      .catch((e) => setError(errMsg(e, 'Could not load radiology systems.')))
      .finally(() => setLoadingSystems(false));
  }, []);

  const update = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.title.trim()) {
      setError('Please enter a case title.');
      return;
    }

    if (!form.system_id) {
      setError('Please select a radiology system.');
      return;
    }

    setSaving(true);

    try {
      const result = await adminService.createCase({
        ...form,
        title: form.title.trim(),
        system_id: Number(form.system_id),
        status: 'draft',
      });

      onCreated(result.id);
    } catch (e) {
      setError(errMsg(e, 'Could not create the case.'));
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm';

  return (
    <form onSubmit={submit} className="space-y-4">
      <Banner>{error}</Banner>

      <label className="block text-sm">
        Case title *
        <input
          name="title"
          value={form.title}
          onChange={update}
          required
          maxLength={255}
          className={fieldClass}
          placeholder="e.g. Tetralogy of Fallot"
        />
      </label>

      <label className="block text-sm">
        Radiology system *
        <select
          name="system_id"
          value={form.system_id}
          onChange={update}
          required
          disabled={loadingSystems}
          className={fieldClass}
        >
          <option value="">
            {loadingSystems ? 'Loading systems…' : 'Select a system'}
          </option>
          {systems.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        Modality
        <input
          name="modality"
          value={form.modality}
          onChange={update}
          maxLength={50}
          className={fieldClass}
          placeholder="e.g. X-ray, CT, MRI, Ultrasound"
        />
      </label>

      <label className="block text-sm">
        Clinical information
        <textarea
          name="clinical_info"
          value={form.clinical_info}
          onChange={update}
          rows={3}
          className={fieldClass}
        />
      </label>

      <label className="block text-sm">
        Question
        <textarea
          name="question_text"
          value={form.question_text}
          onChange={update}
          rows={2}
          className={fieldClass}
        />
      </label>

      <label className="block text-sm">
        Correct answer
        <input
          name="correct_answer"
          value={form.correct_answer}
          onChange={update}
          maxLength={255}
          className={fieldClass}
        />
      </label>

      <label className="block text-sm">
        Explanation
        <textarea
          name="explanation"
          value={form.explanation}
          onChange={update}
          rows={3}
          className={fieldClass}
        />
      </label>

      <label className="block text-sm">
        Key findings
        <textarea
          name="key_findings"
          value={form.key_findings}
          onChange={update}
          rows={2}
          className={fieldClass}
        />
      </label>

      <label className="block text-sm">
        Learning points
        <textarea
          name="learning_points"
          value={form.learning_points}
          onChange={update}
          rows={2}
          className={fieldClass}
        />
      </label>

      <label className="block text-sm">
        Differential diagnosis
        <textarea
          name="differential_diagnosis"
          value={form.differential_diagnosis}
          onChange={update}
          rows={2}
          className={fieldClass}
        />
      </label>

      <label className="block text-sm">
        Difficulty
        <select
          name="difficulty"
          value={form.difficulty}
          onChange={update}
          className={fieldClass}
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </label>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || loadingSystems || systems.length === 0}
          className="rounded-lg bg-spotter-blue px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {saving ? 'Creating…' : 'Create Draft'}
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
function CaseImages({ caseId, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef(null);

  const load = useCallback(() => {
    setError('');
    return adminService
      .getCase(caseId)
      .then((r) => setDetail(r.case))
      .catch((e) => setError(errMsg(e, 'Could not load this case.')));
  }, [caseId]);

  useEffect(() => {
    setDetail(null);
    setNotice('');
    load();
  }, [load]);

  const upload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setError('');
    setNotice('');
    const bad = files.find((f) => !ALLOWED.includes(f.type) || f.size > MAX_BYTES);
    if (bad) {
      setError(
        !ALLOWED.includes(bad.type)
          ? `"${bad.name}" is not a JPEG, PNG or WebP image.`
          : `"${bad.name}" is larger than 10 MB.`
      );
      return;
    }
    if (files.length > 10) {
      setError('You can upload at most 10 images at a time.');
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const res = await adminService.uploadImages(caseId, files, setProgress);
      setNotice(`${res.images.length} image${res.images.length === 1 ? '' : 's'} uploaded.`);
      await load();
      onChanged();
    } catch (err) {
      setError(errMsg(err, err.code === 'ECONNABORTED' ? 'The upload timed out. Try fewer or smaller files.' : 'Upload failed. Please try again.'));
    } finally {
      setUploading(false);
    }
  };

  const remove = async (img) => {
    if (!window.confirm('Delete this image? This also deletes the stored file.')) return;
    setError('');
    try {
      await adminService.deleteImage(img.id);
      await load();
      onChanged();
    } catch (err) {
      setError(errMsg(err, 'Could not delete the image.'));
    }
  };

  if (!detail) return <p className="text-sm text-gray-400">{error || 'Loading…'}</p>;

  return (
    <div className="space-y-4">
      <Banner>{error}</Banner>
      <Banner kind="ok">{notice}</Banner>

      {detail.images.length === 0 ? (
        <p className="text-sm text-gray-500">No images yet for this case.</p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {detail.images.map((img, i) => (
            <li key={img.id} className="relative rounded-lg overflow-hidden bg-navy-950 aspect-square">
              <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white/30">Image unavailable</span>
              <img
                src={img.image_url}
                alt={`Case image ${i + 1}`}
                className="relative w-full h-full object-cover"
                onError={(ev) => { ev.currentTarget.style.display = 'none'; }}
              />
              <button
                onClick={() => remove(img)}
                className="absolute top-1.5 right-1.5 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white hover:bg-red-600"
                aria-label={`Delete image ${i + 1}`}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={upload} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-lg bg-spotter-blue px-4 py-2 text-sm font-medium text-white hover:bg-spotter-blue-dark disabled:opacity-50"
        >
          {uploading ? `Uploading… ${progress}%` : 'Upload images'}
        </button>
        {uploading && (
          <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
            <div className="h-full bg-spotter-blue transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        <p className="mt-2 text-xs text-gray-400">JPEG, PNG or WebP · up to 10 MB each · up to 10 at a time.</p>
      </div>
    </div>
  );
}

function TestBlocks({ cases, refreshKey }) {
  const { user } = useAuth();
  const [blocks, setBlocks] = useState(null);
  const [error, setError] = useState('');
  const [selection, setSelection] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() =>
    adminService.listTests().then((r) => setBlocks(r.blocks)).catch((e) => setError(errMsg(e, 'Could not load test blocks.'))), []);
  useEffect(() => { load(); }, [load, refreshKey]);

  if (user.role !== 'admin') return <p className="text-sm text-gray-500">Only admins can assign cases to test blocks.</p>;
  if (!blocks) return <p className="text-sm text-gray-400">{error || 'Loading…'}</p>;

  const publishable = cases.filter((c) => c.status === 'published');

  const act = async (fn) => {
    setBusy(true);
    setError('');
    try { await fn(); await load(); } catch (e) { setError(errMsg(e, 'That action failed.')); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <Banner>{error}</Banner>
      {blocks.map((b) => {
        const taken = new Set(b.questions.map((q) => q.case_id));
        const options = publishable.filter((c) => !taken.has(c.id));
        return (
          <div key={b.id} className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-medium text-navy-950">Block {b.block_number}</h3>
              <span className="font-mono text-xs text-gray-500">{b.questions.length}/{b.total_questions} questions</span>
            </div>
            {b.questions.length === 0 ? (
              <p className="mt-2 text-sm text-gray-400">No questions assigned yet.</p>
            ) : (
              <ol className="mt-2 divide-y divide-gray-100 text-sm">
                {b.questions.map((q) => (
                  <li key={q.id} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="truncate"><span className="font-mono text-xs text-gray-400 mr-2">{q.question_order}</span>{q.title}{q.status !== 'published' && <span className="ml-2 text-xs text-amber-700">({q.status})</span>}</span>
                    <button disabled={busy} onClick={() => act(() => adminService.removeTestQuestion(b.id, q.id))} className="text-xs text-red-600 hover:underline disabled:opacity-50">Remove</button>
                  </li>
                ))}
              </ol>
            )}
            {b.questions.length < b.total_questions && (
              <div className="mt-3 flex gap-2">
                <select
                  value={selection[b.id] || ''}
                  onChange={(e) => setSelection({ ...selection, [b.id]: e.target.value })}
                  className="flex-1 min-w-0 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  aria-label={`Case to add to block ${b.block_number}`}
                >
                  <option value="">{options.length ? 'Choose a published case…' : 'No published cases available'}</option>
                  {options.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
                <button
                  disabled={busy || !selection[b.id]}
                  onClick={() => act(async () => { await adminService.addTestQuestion(b.id, Number(selection[b.id])); setSelection({ ...selection, [b.id]: '' }); })}
                  className="rounded-lg bg-spotter-blue px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminCases() {
  const [cases, setCases] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const load = useCallback(
  () =>
    adminService
      .listCases()
      .then((r) => setCases(r.cases))
      .catch((e) => setError(errMsg(e, 'Could not load cases.'))),
  []
);

const handleCreated = async (id) => {
  setShowCreateForm(false);
  setNotice('Case created successfully. You can now upload images.');
  await load();
  setSelectedId(id);
};
  useEffect(() => { load(); }, [load]);

  const changed = () => { load(); setRefreshKey((k) => k + 1); };
  const selected = cases?.find((c) => c.id === selectedId);

  const changeStatus = async (status) => {
    setError('');
    try { await adminService.setStatus(selected.id, status); changed(); }
    catch (e) { setError(errMsg(e, 'Could not change the status.')); }
  };

  return (
    <DashboardLayout>
      <main className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="font-display font-semibold text-2xl text-navy-950">Content Management</h1>
        <div className="mt-4">
  <button
    onClick={() => {
      setNotice('');
      setShowCreateForm(true);
    }}
    className="rounded-lg bg-spotter-blue px-4 py-2 text-sm font-medium text-white hover:bg-spotter-blue-dark"
  >
    + Create New Case
  </button>
</div>

<div className="mt-4">
  <Banner kind="ok">{notice}</Banner>
</div>

{showCreateForm && (
  <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
    <h2 className="mb-4 text-lg font-semibold text-navy-950">
      Create a New Radiology Case
    </h2>

    <CreateCaseForm
      onCreated={handleCreated}
      onCancel={() => setShowCreateForm(false)}
    />
  </section>
)}
        <p className="mt-1 text-gray-500">Attach images to cases and assign published cases to test blocks.</p>
        <div className="mt-6"><Banner>{error}</Banner></div>

        {!cases ? (
          <p className="mt-8 text-sm text-gray-400">Loading cases…</p>
        ) : (
          <div className="mt-6 grid lg:grid-cols-5 gap-6">
            <section className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-4">
              <h2 className="font-display font-semibold text-lg text-navy-950">Cases</h2>
              {cases.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">No cases yet. Create them with the admin API or <code className="text-xs">scripts/importCases.js</code>.</p>
              ) : (
                <ul className="mt-3 divide-y divide-gray-100 max-h-[32rem] overflow-y-auto">
                  {cases.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => setSelectedId(c.id)}
                        aria-current={c.id === selectedId}
                        className={`w-full text-left px-2 py-2.5 rounded-lg text-sm transition ${c.id === selectedId ? 'bg-spotter-blue/10' : 'hover:bg-gray-50'}`}
                      >
                        <span className="block font-medium text-navy-950 truncate">{c.title}</span>
                        <span className="block text-xs text-gray-500">{c.system_name} · {c.status} · {c.image_count} image{Number(c.image_count) === 1 ? '' : 's'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="lg:col-span-3 rounded-2xl border border-gray-200 bg-white p-4">
              {!selected ? (
                <p className="text-sm text-gray-500">Select a case to manage its images.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-display font-semibold text-lg text-navy-950 truncate">{selected.title}</h2>
                    <label className="text-xs text-gray-500 flex items-center gap-2 shrink-0">
                      Status
                      <select value={selected.status} onChange={(e) => changeStatus(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm">
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Publishing requires an answer key and at least one image. Test questions reuse these same images.</p>
                  <div className="mt-4"><CaseImages caseId={selected.id} onChanged={changed} /></div>
                </>
              )}
            </section>
          </div>
        )}

        {cases && (
          <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-4">
            <h2 className="font-display font-semibold text-lg text-navy-950">Test Blocks</h2>
            <p className="mt-1 mb-4 text-xs text-gray-400">Only published cases with an answer key can be added. A question that students have answered cannot be removed.</p>
            <TestBlocks cases={cases} refreshKey={refreshKey} />
          </section>
        )}
      </main>
    </DashboardLayout>
  );
}
