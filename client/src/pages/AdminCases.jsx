import { useCallback, useEffect, useRef, useState } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
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

function CreateCaseForm({ blocks, onCreated, onCancel }) {
  const [systems, setSystems] = useState([]);
  const [loadingSystems, setLoadingSystems] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [publishNow, setPublishNow] = useState(true);
  const [assignBlockId, setAssignBlockId] = useState('1');

  const [form, setForm] = useState({
    title: '',
    system_id: '',
    modality: 'MRI',
    clinical_info: '',
    question_text: 'Identify the most likely diagnosis.',
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

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    const bad = selected.find((f) => !ALLOWED.includes(f.type) || f.size > MAX_BYTES);
    if (bad) {
      setError(
        !ALLOWED.includes(bad.type)
          ? `"${bad.name}" is not a JPEG, PNG or WebP image.`
          : `"${bad.name}" is larger than 10 MB.`
      );
      return;
    }
    setError('');
    setFiles(selected);
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

    if (publishNow && (!form.correct_answer.trim() || files.length === 0)) {
      setError('To publish immediately, please provide a Correct Answer and select at least one image.');
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

      const newCaseId = result.id;

      if (files.length > 0) {
        await adminService.uploadImages(newCaseId, files);
      }

      if (videoUrl.trim()) {
        await adminService.addVideo(newCaseId, { video_url: videoUrl.trim(), title: 'Video Explanation' });
      }
      if (videoFile) {
        await adminService.uploadVideo(newCaseId, videoFile, 'Video Explanation');
      }

      if (publishNow && form.correct_answer.trim() && files.length > 0) {
        await adminService.setStatus(newCaseId, 'published');
      }

      onCreated(
        newCaseId,
        publishNow
          ? 'Case created, published, and automatically added randomly to Test Blocks!'
          : 'Case draft created successfully.'
      );
    } catch (e) {
      setError(errMsg(e, 'Could not create the case.'));
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm';

  return (
    <form onSubmit={submit} className="space-y-4">
      <Banner>{error}</Banner>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block text-sm font-medium text-navy-950">
          Case title / internal name *
          <input
            name="title"
            value={form.title}
            onChange={update}
            required
            maxLength={255}
            className={fieldClass}
            placeholder="e.g. Glioblastoma Multiforme"
          />
        </label>

        <label className="block text-sm font-medium text-navy-950">
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
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block text-sm font-medium text-navy-950">
          Modality
          <input
            name="modality"
            value={form.modality}
            onChange={update}
            maxLength={50}
            className={fieldClass}
            placeholder="e.g. MRI, CT, X-Ray, Ultrasound"
          />
        </label>

        <label className="block text-sm font-medium text-navy-950">
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
      </div>

      <label className="block text-sm font-medium text-navy-950">
        Correct answer (Answer Key) *
        <input
          name="correct_answer"
          value={form.correct_answer}
          onChange={update}
          maxLength={255}
          className={fieldClass}
          placeholder="e.g. Glioblastoma | GBM | High-grade glioma (separate synonyms with |)"
        />
        <span className="mt-1 block text-xs text-gray-400 font-normal">
          Tip: Separate multiple accepted answers with <code className="bg-gray-100 px-1 rounded">|</code> so any matching synonym is graded correct.
        </span>
      </label>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block text-sm font-medium text-navy-950">
          Clinical information (shown to student)
          <textarea
            name="clinical_info"
            value={form.clinical_info}
            onChange={update}
            rows={2}
            className={fieldClass}
            placeholder="e.g. 45-year-old presenting with headache and seizures."
          />
        </label>

        <label className="block text-sm font-medium text-navy-950">
          Question prompt
          <textarea
            name="question_text"
            value={form.question_text}
            onChange={update}
            rows={2}
            className={fieldClass}
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-navy-950">
        Explanation (shown after test / in revision)
        <textarea
          name="explanation"
          value={form.explanation}
          onChange={update}
          rows={2}
          className={fieldClass}
          placeholder="Explain the key radiological features..."
        />
      </label>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
        <label className="block text-sm font-medium text-navy-950">
          Upload Case Image(s) (JPEG, PNG, WebP — up to 10 slices)
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="mt-1.5 block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-spotter-blue file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-spotter-blue-dark"
          />
          {files.length > 0 && (
            <span className="mt-1 block text-xs text-green-700 font-normal">
              {files.length} image{files.length > 1 ? 's' : ''} selected
            </span>
          )}
        </label>

        <div className="pt-2 border-t border-gray-200 grid sm:grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-navy-950">
            Video Explanation URL (YouTube, Vimeo, or MP4 — optional)
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-normal"
            />
          </label>
          <label className="block text-xs font-medium text-navy-950">
            Or Upload Video File (.mp4 / .webm — optional)
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full text-xs text-gray-600 file:mr-2 file:rounded-lg file:border-0 file:bg-gray-200 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-navy-950"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-gray-200">
          <label className="inline-flex items-center gap-2 text-sm text-navy-950 cursor-pointer">
            <input
              type="checkbox"
              checked={publishNow}
              onChange={(e) => setPublishNow(e.target.checked)}
              className="rounded border-gray-300 text-spotter-blue"
            />
            Publish immediately
          </label>

          {publishNow && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-spotter-blue/10 px-3 py-1 text-xs font-medium text-spotter-blue">
              ✨ Automatically placed randomly &amp; uniquely into Test Blocks upon publish
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || loadingSystems || systems.length === 0}
          className="rounded-lg bg-spotter-blue hover:bg-spotter-blue-dark px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : publishNow ? 'Create, Publish & Save' : 'Create Draft'}
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

function CaseEditor({ caseId, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [savingFields, setSavingFields] = useState(false);
  const [progress, setProgress] = useState(0);
  const [editingText, setEditingText] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [savingVideo, setSavingVideo] = useState(false);
  const fileRef = useRef(null);
  const videoFileRef = useRef(null);

  const load = useCallback(() => {
    setError('');
    return adminService
      .getCase(caseId)
      .then((r) => {
        setDetail(r.case);
        setEditForm({
          title: r.case.title || '',
          modality: r.case.modality || '',
          clinical_info: r.case.clinical_info || '',
          question_text: r.case.question_text || '',
          correct_answer: r.case.correct_answer || '',
          explanation: r.case.explanation || '',
        });
      })
      .catch((e) => setError(errMsg(e, 'Could not load this case.')));
  }, [caseId]);

  useEffect(() => {
    setDetail(null);
    setNotice('');
    setEditingText(false);
    load();
  }, [load]);

  const saveCaseText = async (e) => {
    e.preventDefault();
    setSavingFields(true);
    setError('');
    setNotice('');
    try {
      await adminService.updateCase(caseId, editForm);
      setNotice('Question and answer details updated.');
      setEditingText(false);
      await load();
      onChanged();
    } catch (err) {
      setError(errMsg(err, 'Could not update case details.'));
    } finally {
      setSavingFields(false);
    }
  };

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

      {/* Question & Answer summary / editor */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-navy-950">Question &amp; Answer Key</span>
          <button
            type="button"
            onClick={() => setEditingText((v) => !v)}
            className="text-xs font-medium text-spotter-blue hover:underline"
          >
            {editingText ? 'Cancel Edit' : '✎ Edit Question / Answer'}
          </button>
        </div>

        {!editingText ? (
          <div className="mt-2 space-y-1.5 text-xs text-gray-600">
            <p><strong>Correct Answer:</strong> <span className="text-green-700 font-medium">{detail.correct_answer || 'Not set'}</span></p>
            {detail.clinical_info && <p><strong>Clinical Info:</strong> {detail.clinical_info}</p>}
            {detail.question_text && <p><strong>Question:</strong> {detail.question_text}</p>}
            {detail.explanation && <p><strong>Explanation:</strong> {detail.explanation}</p>}
          </div>
        ) : (
          <form onSubmit={saveCaseText} className="mt-3 space-y-3">
            <label className="block text-xs font-medium text-navy-950">
              Case Title
              <input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="mt-1 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
                required
              />
            </label>
            <label className="block text-xs font-medium text-navy-950">
              Correct Answer (separate synonyms with |)
              <input
                value={editForm.correct_answer}
                onChange={(e) => setEditForm({ ...editForm, correct_answer: e.target.value })}
                className="mt-1 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-navy-950">
              Clinical Info
              <textarea
                rows={2}
                value={editForm.clinical_info}
                onChange={(e) => setEditForm({ ...editForm, clinical_info: e.target.value })}
                className="mt-1 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-navy-950">
              Question Prompt
              <input
                value={editForm.question_text}
                onChange={(e) => setEditForm({ ...editForm, question_text: e.target.value })}
                className="mt-1 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-navy-950">
              Explanation
              <textarea
                rows={2}
                value={editForm.explanation}
                onChange={(e) => setEditForm({ ...editForm, explanation: e.target.value })}
                className="mt-1 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={savingFields}
              className="rounded-lg bg-spotter-blue px-4 py-1.5 text-xs font-semibold text-white hover:bg-spotter-blue-dark disabled:opacity-50"
            >
              {savingFields ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        )}
      </div>

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

      {/* Video Explanations Manager (shown in AI Case Mentor after answering & in Practice) */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-navy-950">Video Explanation (AI Case Mentor &amp; Practice)</h3>
          <p className="text-xs text-gray-500">
            Shown automatically in AI Case Mentor right after a student submits their diagnosis. Supports YouTube, Vimeo, or uploaded MP4/WebM files.
          </p>
        </div>

        {detail.videos && detail.videos.length > 0 ? (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white text-xs">
            {detail.videos.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="font-medium text-navy-950 truncate">{v.title || 'Video Explanation'}</p>
                  <p className="text-gray-400 truncate">{v.video_url}</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setError('');
                    try {
                      await adminService.deleteVideo(v.id);
                      await load();
                    } catch (err) {
                      setError(errMsg(err, 'Could not remove video.'));
                    }
                  }}
                  className="shrink-0 text-red-600 hover:underline font-medium"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-400">No video explanation attached to this case yet.</p>
        )}

        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={videoTitle}
            onChange={(e) => setVideoTitle(e.target.value)}
            placeholder="Title (optional, e.g. Dr. Walkthrough)"
            className="w-44 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs"
          />
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="Paste YouTube, Vimeo, or .mp4 URL..."
            className="flex-1 min-w-[180px] rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs"
          />
          <button
            type="button"
            disabled={savingVideo || !videoUrl.trim()}
            onClick={async () => {
              setSavingVideo(true);
              setError('');
              setNotice('');
              try {
                await adminService.addVideo(caseId, {
                  video_url: videoUrl.trim(),
                  title: videoTitle.trim() || 'Video Explanation',
                });
                setVideoUrl('');
                setVideoTitle('');
                setNotice('Video link added to this case.');
                await load();
              } catch (err) {
                setError(errMsg(err, 'Could not add video URL.'));
              } finally {
                setSavingVideo(false);
              }
            }}
            className="rounded-lg bg-spotter-blue hover:bg-spotter-blue-dark px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            Add Video Link
          </button>

          <input
            ref={videoFileRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setSavingVideo(true);
              setError('');
              setNotice('');
              try {
                await adminService.uploadVideo(caseId, file, videoTitle.trim() || 'Video Explanation');
                setVideoTitle('');
                setNotice('Video file uploaded and attached to this case.');
                await load();
              } catch (err) {
                setError(errMsg(err, 'Video upload failed.'));
              } finally {
                setSavingVideo(false);
              }
            }}
          />
          <button
            type="button"
            disabled={savingVideo}
            onClick={() => videoFileRef.current?.click()}
            className="rounded-lg border border-gray-300 bg-white hover:bg-gray-100 px-3 py-1.5 text-xs font-medium text-navy-950 disabled:opacity-50"
          >
            {savingVideo ? 'Saving…' : 'Upload .mp4 File'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TestBlocks({ cases, blocks, questionsPerBlock, onReloadBlocks }) {
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [newSeconds, setNewSeconds] = useState(60);
  const [perBlockCap, setPerBlockCap] = useState(questionsPerBlock || 10);

  useEffect(() => {
    if (questionsPerBlock) setPerBlockCap(questionsPerBlock);
  }, [questionsPerBlock]);

  if (!blocks) return <p className="text-sm text-gray-400">{error || 'Loading…'}</p>;

  const publishable = cases.filter((c) => c.status === 'published');

  const act = async (fn, successMsg = '') => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      await onReloadBlocks();
      if (successMsg) setNotice(successMsg);
    } catch (e) {
      setError(errMsg(e, 'That action failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Banner>{error}</Banner>
      <Banner kind="ok">{notice}</Banner>

      {/* Automatic Random Block Distributor Panel */}
      <div className="rounded-xl border border-spotter-blue/30 bg-spotter-blue/5 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-spotter-blue px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-white">
                Auto-Random Active
              </span>
              <p className="text-sm font-semibold text-navy-950">
                Automatic Random &amp; Unique Block Assignment
              </p>
            </div>
            <p className="mt-1 text-xs text-gray-600">
              Whenever you add and publish a case, it is automatically added at random to a test block with 100% unique cases across all blocks ({publishable.length} published case{publishable.length === 1 ? '' : 's'} total). As blocks fill up, new block numbers (Block {blocks.length ? Math.max(...blocks.map((b) => b.block_number)) + 1 : 1}+) are created automatically without limit.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-medium text-navy-950 flex items-center gap-1.5 bg-white rounded-lg border border-gray-300 px-2.5 py-1.5">
              <span>Max Cases / Block:</span>
              <input
                type="number"
                min={1}
                max={100}
                value={perBlockCap}
                onChange={(e) => setPerBlockCap(Math.max(1, Number(e.target.value) || 10))}
                className="w-14 rounded border border-gray-200 px-1.5 py-0.5 text-sm font-semibold text-center"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                act(
                  () => adminService.shuffleTests(perBlockCap),
                  `All ${publishable.length} published cases have been randomly & uniquely shuffled across blocks (${perBlockCap} max per block)!`
                )
              }
              className="rounded-lg bg-spotter-blue hover:bg-spotter-blue-dark px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Updating…' : '🔀 Shuffle & Redistribute Randomly'}
            </button>
          </div>
        </div>

        {/* Optional pre-create extra block bar */}
        <div className="pt-3 border-t border-spotter-blue/15 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
          <span>
            Want to pre-create an additional block manually? Next block number is{' '}
            <strong className="text-navy-950">
              Block {blocks.length ? Math.max(...blocks.map((b) => b.block_number)) + 1 : 1}
            </strong>
            .
          </span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5">
              Seconds / question:
              <input
                type="number"
                min={10}
                max={600}
                value={newSeconds}
                onChange={(e) => setNewSeconds(Number(e.target.value) || 60)}
                className="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-xs"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                act(
                  () => adminService.createTest({ seconds_per_question: newSeconds }),
                  'Extra test block created!'
                )
              }
              className="rounded-lg border border-gray-300 bg-white hover:bg-gray-50 px-3 py-1 text-xs font-medium text-navy-950 disabled:opacity-50"
            >
              + Add Next Block
            </button>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {blocks.map((b) => (
          <div key={b.id} className="rounded-xl border border-gray-200 p-4 flex flex-col justify-between bg-white">
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-navy-950">Block {b.block_number}</h3>
                  <span className="font-mono text-xs text-gray-500">
                    {b.questions.length} / {perBlockCap} unique case{b.questions.length === 1 ? '' : 's'} · {b.seconds_per_question}s/Q
                  </span>
                </div>
                {b.questions.length === 0 && blocks.length > 1 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(() => adminService.deleteTest(b.id), `Deleted empty Block ${b.block_number}.`)}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    Delete Empty Block
                  </button>
                )}
              </div>

              {b.questions.length === 0 ? (
                <p className="mt-3 text-xs text-gray-400 italic">
                  Waiting for more cases — will populate automatically as new cases are added.
                </p>
              ) : (
                <ol className="mt-3 divide-y divide-gray-100 text-xs">
                  {b.questions.map((q, idx) => (
                    <li key={q.id} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="truncate text-navy-950 font-medium">
                        <span className="font-mono text-[11px] text-spotter-blue mr-2">Q{idx + 1}</span>
                        Case #{q.case_id} — {q.system_name || 'Radiology'}
                        {q.modality ? ` (${q.modality})` : ''}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-gray-400">
                        Unique · Random
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminCases() {
  const [cases, setCases] = useState(null);
  const [blocks, setBlocks] = useState(null);
  const [questionsPerBlock, setQuestionsPerBlock] = useState(10);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const loadCases = useCallback(
    () =>
      adminService
        .listCases()
        .then((r) => setCases(r.cases))
        .catch((e) => setError(errMsg(e, 'Could not load cases.'))),
    []
  );

  const loadBlocks = useCallback(
    () =>
      adminService
        .listTests()
        .then((r) => {
          setBlocks(r.blocks);
          if (r.questionsPerBlock) setQuestionsPerBlock(r.questionsPerBlock);
        })
        .catch((e) => setError(errMsg(e, 'Could not load test blocks.'))),
    []
  );

  useEffect(() => {
    loadCases();
    loadBlocks();
  }, [loadCases, loadBlocks]);

  const handleCreated = async (id, msg) => {
    setShowCreateForm(false);
    setNotice(msg || 'Case created successfully.');
    await Promise.all([loadCases(), loadBlocks()]);
    setSelectedId(id);
  };

  const changed = () => {
    loadCases();
    loadBlocks();
  };

  const selected = cases?.find((c) => c.id === selectedId);

  const changeStatus = async (status) => {
    setError('');
    try {
      await adminService.setStatus(selected.id, status);
      changed();
    } catch (e) {
      setError(errMsg(e, 'Could not change the status.'));
    }
  };

  return (
    <DashboardLayout>
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display font-semibold text-2xl text-navy-950">Questions, Cases &amp; Test Blocks</h1>
            <p className="mt-1 text-gray-500">Create your own radiology questions &amp; answers, upload images, and organize test blocks.</p>
          </div>
          <button
            onClick={() => {
              setNotice('');
              setShowCreateForm((v) => !v);
            }}
            className="rounded-lg bg-spotter-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-spotter-blue-dark"
          >
            {showCreateForm ? 'Close Form' : '+ Add New Question / Case'}
          </button>
        </div>

        <div className="mt-4">
          <Banner kind="ok">{notice}</Banner>
          <Banner>{error}</Banner>
        </div>

        {showCreateForm && (
          <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-navy-950">
              Add a New Radiology Question &amp; Answer
            </h2>

            <CreateCaseForm
              blocks={blocks}
              onCreated={handleCreated}
              onCancel={() => setShowCreateForm(false)}
            />
          </section>
        )}

        {!cases ? (
          <p className="mt-8 text-sm text-gray-400">Loading cases…</p>
        ) : (
          <div className="mt-6 grid lg:grid-cols-5 gap-6">
            <section className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-4">
              <h2 className="font-display font-semibold text-lg text-navy-950">All Questions / Cases ({cases.length})</h2>
              {cases.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">No cases yet. Click "+ Add New Question / Case" above.</p>
              ) : (
                <ul className="mt-3 divide-y divide-gray-100 max-h-[32rem] overflow-y-auto">
                  {cases.map((c, idx) => (
                    <li key={c.id}>
                      <button
                        onClick={() => setSelectedId(c.id)}
                        aria-current={c.id === selectedId}
                        className={`w-full text-left px-2 py-2.5 rounded-lg text-sm transition ${c.id === selectedId ? 'bg-spotter-blue/10' : 'hover:bg-gray-50'}`}
                      >
                        <span className="block font-medium text-navy-950 truncate">
                          Case {idx + 1}: {c.title}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {c.system_name} · <span className={c.status === 'published' ? 'text-green-700 font-medium' : 'text-amber-700'}>{c.status}</span> · {c.image_count} image{Number(c.image_count) === 1 ? '' : 's'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="lg:col-span-3 rounded-2xl border border-gray-200 bg-white p-4">
              {!selected ? (
                <p className="text-sm text-gray-500">Select a question/case on the left to edit its answer key, text, or images.</p>
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
                  <p className="mt-1 text-xs text-gray-400">Published cases appear automatically in Practice, AI Case Mentor, and are randomly &amp; uniquely assigned to Test Blocks.</p>
                  <div className="mt-4"><CaseEditor caseId={selected.id} onChanged={changed} /></div>
                </>
              )}
            </section>
          </div>
        )}

        {cases && (
          <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="font-display font-semibold text-lg text-navy-950">Automatic Random Test Blocks</h2>
            <p className="mt-1 mb-4 text-xs text-gray-400">
              Test blocks automatically select unique published cases at random. As you add more cases, blocks fill up and new block numbers (Block 6, Block 7, …) are created automatically.
            </p>
            <TestBlocks
              cases={cases}
              blocks={blocks}
              questionsPerBlock={questionsPerBlock}
              onReloadBlocks={loadBlocks}
            />
          </section>
        )}
      </main>
    </DashboardLayout>
  );
}
