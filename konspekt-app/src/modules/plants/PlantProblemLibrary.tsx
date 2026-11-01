import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { activePlants, filteredPlantProblems, plantPhotosForComparison } from '../../core/selectors';
import { useStore } from '../../core/store';
import { uid, type PlantProblem, type PlantProblemCategory } from '../../core/types';
import { deletePlantPhotos, getPlantPhoto, storePlantPhotos } from '../../core/plantPhotoStorage';
import { useConfirm } from '../../ui/ConfirmDialog';
import { TrashIcon } from '../../ui/icons';
import { preparePlantPhoto } from './preparePlantPhoto';
import { PlantSubtabs } from './PlantSubtabs';

const CATEGORY_LABELS: Record<PlantProblemCategory, string> = {
  deficit: 'Дефицит',
  excess: 'Переизбыток',
  pest: 'Вредители',
  mechanical: 'Механические',
};

function isProblemCategory(value: string): value is PlantProblemCategory {
  return value === 'deficit' || value === 'excess' || value === 'pest' || value === 'mechanical';
}

interface ProblemDraft {
  title: string;
  description: string;
  category: PlantProblemCategory;
  cause: string;
  signs: string;
  correction: string;
}

export function PlantProblemLibrary() {
  const { state, update } = useStore();
  const confirm = useConfirm();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ problem: PlantProblem | null } | null>(null);
  const [comparisonProblem, setComparisonProblem] = useState<PlantProblem | null>(null);
  const problems = filteredPlantProblems(state);
  const detail = state.plantProblems.find((problem) => problem.id === detailId) ?? null;

  const saveProblem = async (
    draft: ProblemDraft,
    existingPhotoIds: string[],
    newPhotos: File[],
    current: PlantProblem | null,
  ) => {
    const title = draft.title.trim();
    if (!title) throw new Error('Укажите название проблемы.');

    const createdAt = current?.createdAt ?? Date.now();
    const addedPhotos = await Promise.all(newPhotos.map(async (file) => ({
      id: uid(),
      blob: await preparePlantPhoto(file),
    })));
    const nextProblem: PlantProblem = {
      id: current?.id ?? uid(),
      ...draft,
      title,
      photoIds: [...existingPhotoIds, ...addedPhotos.map((photo) => photo.id)],
      isDemo: false,
      createdAt,
      updatedAt: Date.now(),
    };
    const usedElsewhere = new Set([
      ...state.waterings.flatMap((entry) => entry.photoIds ?? []),
      ...state.plantProblems
        .filter((problem) => problem.id !== current?.id)
        .flatMap((problem) => problem.photoIds),
    ]);
    const removedPhotoIds = (current?.photoIds ?? []).filter((id) => !nextProblem.photoIds.includes(id) && !usedElsewhere.has(id));

    try {
      if (addedPhotos.length) await storePlantPhotos(addedPhotos);
      if (removedPhotoIds.length) await deletePlantPhotos(removedPhotoIds);
    } catch (error) {
      if (addedPhotos.length) {
        try {
          await deletePlantPhotos(addedPhotos.map((photo) => photo.id));
        } catch (cleanupError) {
          const cleanupMessage = cleanupError instanceof Error ? cleanupError.message : 'Не удалось очистить новые фотографии.';
          throw new Error(`${error instanceof Error ? error.message : 'Не удалось сохранить фотографии.'} ${cleanupMessage}`);
        }
      }
      throw error;
    }

    update((draftState) => {
      const index = draftState.plantProblems.findIndex((problem) => problem.id === nextProblem.id);
      if (index >= 0) draftState.plantProblems[index] = nextProblem;
      else draftState.plantProblems.push(nextProblem);
    });
    setEditor(null);
    setDetailId(nextProblem.id);
  };

  const deleteProblem = async (problem: PlantProblem) => {
    const ok = await confirm({
      title: 'Удалить карточку?',
      message: `Карточка «${problem.title}» будет удалена безвозвратно.`,
      confirmLabel: 'Удалить',
    });
    if (!ok) return;
    const usedElsewhere = new Set([
      ...state.waterings.flatMap((entry) => entry.photoIds ?? []),
      ...state.plantProblems
        .filter((item) => item.id !== problem.id)
        .flatMap((item) => item.photoIds),
    ]);
    try {
      await deletePlantPhotos(problem.photoIds.filter((id) => !usedElsewhere.has(id)));
    } catch (error) {
      await confirm({
        title: 'Не удалось удалить фотографии',
        message: error instanceof Error ? error.message : 'Ошибка локального хранилища.',
        confirmLabel: 'Понятно',
      });
      return;
    }
    update((draft) => { draft.plantProblems = draft.plantProblems.filter((item) => item.id !== problem.id); });
    setDetailId(null);
  };

  const confirmPhotoRemoval = async () => confirm({
    title: 'Убрать фотографию из карточки?',
    message: 'Фото будет удалено из карточки при сохранении изменений.',
    confirmLabel: 'Убрать',
  });

  return (
    <>
      <div className="topbar plant-problem-topbar">
        <div className="subject-title-wrap">
          <h1 className="subject-title">{detail ? detail.title : 'Библия растений'}</h1>
          {detail && <span className="plant-problem-category-tag">{CATEGORY_LABELS[detail.category]}</span>}
          {detail?.isDemo && <span className="plant-problem-demo-tag">демо</span>}
          {detail && (
            <div className="plant-problem-title-actions">
              <button type="button" aria-label="Редактировать карточку" title="Редактировать" onClick={() => setEditor({ problem: detail })}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m14 5 5 5M4 20l4.5-1 11-11a2.12 2.12 0 0 0-3-3l-11 11L4 20z" />
                </svg>
              </button>
              <button type="button" className="danger" aria-label="Удалить карточку" title="Удалить" onClick={() => void deleteProblem(detail)}>
                <TrashIcon />
              </button>
            </div>
          )}
        </div>
        {!detail && <button type="button" className="plant-problem-add" onClick={() => setEditor({ problem: null })}>+ Добавить проблему</button>}
      </div>
      <div className="searchbar plant-problem-toolbar">
        <PlantSubtabs plantId={null} />
        {detail ? (
          <button type="button" className="plant-problem-back" onClick={() => setDetailId(null)}>← К библиотеке</button>
        ) : (
          <div className="plant-problem-filters">
            <input
              className="search-input"
              placeholder="Поиск по библиотеке..."
              value={state.plantProblemsSearch}
              onChange={(event) => update((draft) => { draft.plantProblemsSearch = event.target.value; })}
            />
            <select
              aria-label="Фильтр по категории"
              value={state.plantProblemsCategory}
              onChange={(event) => {
                const category = event.target.value;
                if (category === 'all' || isProblemCategory(category)) {
                  update((draft) => { draft.plantProblemsCategory = category; });
                }
              }}
            >
              <option value="all">Все категории</option>
              {Object.entries(CATEGORY_LABELS).map(([category, label]) => (
                <option key={category} value={category}>{label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className={detail ? 'content-scroll plant-problem-detail-scroll' : 'content-scroll plant-problem-grid'}>
        {detail ? (
          <ProblemDetail
            problem={detail}
            onCompare={() => setComparisonProblem(detail)}
          />
        ) : problems.length ? (
          problems.map((problem) => (
            <ProblemCard key={problem.id} problem={problem} onClick={() => setDetailId(problem.id)} />
          ))
        ) : (
          <div className="empty-state plant-problem-empty">
            <span className="display">{state.plantProblems.length ? 'Ничего не найдено' : 'Библиотека пока пуста'}</span>
            {state.plantProblems.length ? 'Попробуйте изменить поиск или категорию.' : 'Добавьте карточку проблемы, чтобы собрать свою справочную библиотеку.'}
          </div>
        )}
      </div>

      {editor && (
        <ProblemEditor
          key={editor.problem?.id ?? 'new'}
          problem={editor.problem}
          onClose={() => setEditor(null)}
          onSave={(draft, photoIds, photos) => saveProblem(draft, photoIds, photos, editor.problem)}
          onConfirmPhotoRemoval={confirmPhotoRemoval}
        />
      )}
      {comparisonProblem && (
        <ProblemComparison
          problem={comparisonProblem}
          onClose={() => setComparisonProblem(null)}
        />
      )}
    </>
  );
}

function ProblemCard({ problem, onClick }: { problem: PlantProblem; onClick: () => void }) {
  return (
    <button type="button" className="plant-problem-card" onClick={onClick}>
      <span className="plant-problem-card-photo">
        {problem.photoIds[0] ? (
          <StoredPhotoImage photoId={problem.photoIds[0]} alt={problem.title} />
        ) : (
          <span className="plant-problem-photo-placeholder">Добавьте фото листа</span>
        )}
      </span>
      <span className="plant-problem-card-copy">
        <small>{CATEGORY_LABELS[problem.category]}{problem.isDemo ? ' · демо' : ''}</small>
        <strong>{problem.title}</strong>
      </span>
    </button>
  );
}

function ProblemDetail({
  problem,
  onCompare,
}: {
  problem: PlantProblem;
  onCompare: () => void;
}) {
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  return (
    <article className="plant-problem-detail">
      <section className="plant-problem-section">
        <div className="plant-problem-section-heading">
          <h2>Фотографии проблемы</h2>
          <span>{problem.photoIds.length}</span>
        </div>
        {problem.photoIds.length ? (
          <div className="plant-problem-photo-grid">
            {problem.photoIds.map((id, index) => (
              <div className="plant-problem-photo-tile" key={id}>
                <button type="button" onClick={() => setLightboxPhoto(id)} aria-label={`Открыть фото ${index + 1}`}>
                  <StoredPhotoImage photoId={id} alt={`${problem.title}, фото ${index + 1}`} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="plant-problem-muted">Добавьте фотографии этой проблемы через редактирование карточки.</p>
        )}
      </section>
      {problem.isDemo && <p className="plant-problem-demo-note">Это демонстрационная карточка. Замените пример своими сведениями.</p>}
      <ProblemInfo title="Описание проблемы" text={problem.description} />
      <ProblemInfo title="Возникает из-за:" text={problem.cause} />
      <ProblemInfo title="Проявляется на листьях:" text={problem.signs} />
      <ProblemInfo title="Для решения нужно:" text={problem.correction} />
      <section className="plant-problem-compare-section">
        <div>
          <h2>Сравнить с растением</h2>
          <p>Выберите фото из записей полива и сравните признаки рядом или с наложением.</p>
        </div>
        <button type="button" onClick={onCompare} disabled={!problem.photoIds.length}>Сравнить фото</button>
        {!problem.photoIds.length && <small>Сначала добавьте хотя бы одно фото проблемы.</small>}
      </section>
      {lightboxPhoto && <PhotoLightbox photoId={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />}
    </article>
  );
}

function ProblemInfo({ title, text }: { title: string; text: string }) {
  return (
    <section className="plant-problem-section">
      <h2>{title}</h2>
      <p>{text || 'Информация пока не добавлена.'}</p>
    </section>
  );
}

function ProblemEditor({
  problem,
  onClose,
  onSave,
  onConfirmPhotoRemoval,
}: {
  problem: PlantProblem | null;
  onClose: () => void;
  onSave: (draft: ProblemDraft, photoIds: string[], photos: File[]) => Promise<void>;
  onConfirmPhotoRemoval: () => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<ProblemDraft>({
    title: problem?.title ?? '',
    description: problem?.description ?? '',
    category: problem?.category ?? 'deficit',
    cause: problem?.cause ?? '',
    signs: problem?.signs ?? '',
    correction: problem?.correction ?? '',
  });
  const [photoIds, setPhotoIds] = useState(problem?.photoIds ?? []);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, saving]);

  const removeExistingPhoto = async (id: string) => {
    if (await onConfirmPhotoRemoval()) setPhotoIds((current) => current.filter((photoId) => photoId !== id));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(draft, photoIds, newPhotos);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить карточку.');
      setSaving(false);
    }
  };

  return createPortal(
    <div className="plant-problem-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <form className="plant-problem-editor" role="dialog" aria-modal="true" aria-labelledby="plant-problem-editor-title" onSubmit={submit}>
        <div className="plant-problem-editor-head">
          <h2 id="plant-problem-editor-title">{problem ? 'Редактировать карточку' : 'Новая проблема'}</h2>
          <button type="button" aria-label="Закрыть" onClick={onClose} disabled={saving}>×</button>
        </div>
        <label>Название
          <input required autoFocus maxLength={100} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </label>
        <label>Описание проблемы
          <textarea rows={2} placeholder="Например, дефицит магния" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
        </label>
        <label>Категория
          <select value={draft.category} onChange={(event) => {
            const category = event.target.value;
            if (isProblemCategory(category)) setDraft({ ...draft, category });
          }}>
            {Object.entries(CATEGORY_LABELS).map(([category, label]) => <option key={category} value={category}>{label}</option>)}
          </select>
        </label>
        <label>Возникает из-за:
          <textarea rows={3} value={draft.cause} onChange={(event) => setDraft({ ...draft, cause: event.target.value })} />
        </label>
        <label>Проявляется на листьях:
          <textarea rows={3} value={draft.signs} onChange={(event) => setDraft({ ...draft, signs: event.target.value })} />
        </label>
        <label>Для решения нужно:
          <textarea rows={3} value={draft.correction} onChange={(event) => setDraft({ ...draft, correction: event.target.value })} />
        </label>
        <div className="plant-problem-editor-photos">
          <strong>Фотографии проблемы</strong>
          {photoIds.length > 0 && (
            <div className="plant-problem-photo-grid compact">
              {photoIds.map((id, index) => (
                <div className="plant-problem-photo-tile" key={id}>
                  <StoredPhotoImage photoId={id} alt={`Фото ${index + 1}`} />
                  <button type="button" className="plant-problem-photo-remove" aria-label={`Убрать фото ${index + 1}`} onClick={() => void removeExistingPhoto(id)}>×</button>
                </div>
              ))}
            </div>
          )}
          <label className="plant-problem-file-picker">
            <span>Добавить фотографии</span>
            <input type="file" accept="image/*" multiple onChange={(event) => {
              const selected = Array.from(event.target.files ?? []);
              event.target.value = '';
              const invalid = selected.find((file) => !file.type.startsWith('image/'));
              if (invalid) {
                setError('Можно прикреплять только изображения.');
                return;
              }
              setError('');
              setNewPhotos((current) => [...current, ...selected]);
            }} />
          </label>
          {newPhotos.map((file, index) => (
            <div className="plant-problem-new-file" key={`${file.name}-${index}`}>
              <span>{file.name}</span>
              <button type="button" aria-label={`Убрать файл ${file.name}`} onClick={() => setNewPhotos((current) => current.filter((_, fileIndex) => fileIndex !== index))}>×</button>
            </div>
          ))}
        </div>
        {error && <p className="plant-problem-editor-error" role="alert">{error}</p>}
        <div className="plant-problem-editor-actions">
          <button type="button" onClick={onClose} disabled={saving}>Отмена</button>
          <button type="submit" disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function ProblemComparison({ problem, onClose }: { problem: PlantProblem; onClose: () => void }) {
  const { state } = useStore();
  const plants = activePlants(state).slice().sort((a, b) => a.name.localeCompare(b.name, 'ru-RU'));
  const [plantId, setPlantId] = useState(() => state.activePlantId && plants.some((plant) => plant.id === state.activePlantId)
    ? state.activePlantId
    : plants[0]?.id ?? '');
  const [problemPhotoId, setProblemPhotoId] = useState(problem.photoIds[0] ?? '');
  const [selectedPlantPhotoId, setSelectedPlantPhotoId] = useState('');
  const [displayMode, setDisplayMode] = useState<'side-by-side' | 'slider'>('side-by-side');
  const [sliderValue, setSliderValue] = useState(50);
  const photos = plantPhotosForComparison(state, plantId);
  const plantPhotoId = photos.some((photo) => photo.id === selectedPlantPhotoId)
    ? selectedPlantPhotoId
    : photos[0]?.id ?? '';

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="plant-problem-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="plant-problem-comparison" role="dialog" aria-modal="true" aria-labelledby="plant-problem-comparison-title">
        <div className="plant-problem-editor-head">
          <h2 id="plant-problem-comparison-title">Сравнение фотографий</h2>
          <button type="button" aria-label="Закрыть" onClick={onClose}>×</button>
        </div>
        <div className="plant-problem-compare-selects">
          <label>Пример проблемы
            <select value={problemPhotoId} onChange={(event) => setProblemPhotoId(event.target.value)}>
              {problem.photoIds.map((id, index) => <option key={id} value={id}>Фото {index + 1}</option>)}
            </select>
          </label>
          <label>Растение
            <select value={plantId} onChange={(event) => setPlantId(event.target.value)}>
              <option value="">Выберите растение</option>
              {plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name}</option>)}
            </select>
          </label>
          <label>Фото растения
            <select value={plantPhotoId} onChange={(event) => setSelectedPlantPhotoId(event.target.value)} disabled={!photos.length}>
              {photos.map((photo, index) => <option key={photo.id} value={photo.id}>Фото {index + 1} · {photo.date}</option>)}
            </select>
          </label>
        </div>
        <div className="plant-problem-compare-modes">
          <button type="button" className={displayMode === 'side-by-side' ? 'active' : ''} onClick={() => setDisplayMode('side-by-side')}>Рядом</button>
          <button type="button" className={displayMode === 'slider' ? 'active' : ''} onClick={() => setDisplayMode('slider')}>Ползунок</button>
        </div>
        {problemPhotoId && plantPhotoId ? (
          displayMode === 'side-by-side' ? (
            <div className="plant-problem-compare-pair">
              <ComparePhoto photoId={problemPhotoId} label="Пример проблемы" />
              <ComparePhoto photoId={plantPhotoId} label={plants.find((plant) => plant.id === plantId)?.name ?? 'Фото растения'} />
            </div>
          ) : (
            <div className="plant-problem-slider-wrap">
              <div className="plant-problem-slider">
                <StoredPhotoImage photoId={problemPhotoId} alt="Пример проблемы" />
                <div className="plant-problem-slider-overlay" style={{ clipPath: `inset(0 ${100 - sliderValue}% 0 0)` }}>
                  <StoredPhotoImage photoId={plantPhotoId} alt="Фото растения" />
                </div>
                <span className="plant-problem-slider-label left">Проблема</span>
                <span className="plant-problem-slider-label right">{plants.find((plant) => plant.id === plantId)?.name ?? 'Растение'}</span>
              </div>
              <label className="plant-problem-slider-control">
                <span>Смещение сравнения</span>
                <input type="range" min="0" max="100" value={sliderValue} onChange={(event) => setSliderValue(Number(event.target.value))} />
              </label>
            </div>
          )
        ) : (
          <div className="plant-problem-compare-empty">
            {plants.length ? 'У выбранного растения пока нет фотографий в записях полива.' : 'Добавьте растение и фотографии в его записи полива, чтобы сравнить.'}
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}

function ComparePhoto({ photoId, label }: { photoId: string; label: string }) {
  return (
    <figure>
      <div className="plant-problem-compare-image"><StoredPhotoImage photoId={photoId} alt={label} /></div>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

function StoredPhotoImage({ photoId, alt }: { photoId: string; alt: string }) {
  const [photo, setPhoto] = useState<{ id: string; url: string; error: string } | null>(null);
  useEffect(() => {
    let active = true;
    let url = '';
    void getPlantPhoto(photoId).then((blob) => {
      if (!blob) throw new Error('Фотография не найдена в локальном хранилище.');
      url = URL.createObjectURL(blob);
      if (active) setPhoto({ id: photoId, url, error: '' });
      else URL.revokeObjectURL(url);
    }).catch((error: unknown) => {
      if (active) setPhoto({ id: photoId, url: '', error: error instanceof Error ? error.message : 'Не удалось загрузить фото.' });
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [photoId]);

  if (photo?.id !== photoId) return <span className="plant-problem-photo-placeholder">Загрузка фото…</span>;
  if (photo.error) return <span className="plant-problem-photo-error" role="alert">{photo.error}</span>;
  return <img src={photo.url} alt={alt} />;
}

function PhotoLightbox({ photoId, onClose }: { photoId: string; onClose: () => void }) {
  const [photo, setPhoto] = useState<{ id: string; url: string; error: string } | null>(null);
  useEffect(() => {
    let active = true;
    let url = '';
    void getPlantPhoto(photoId).then((blob) => {
      if (!blob) throw new Error('Фотография не найдена в локальном хранилище.');
      url = URL.createObjectURL(blob);
      if (active) setPhoto({ id: photoId, url, error: '' });
      else URL.revokeObjectURL(url);
    }).catch((error: unknown) => {
      if (active) setPhoto({ id: photoId, url: '', error: error instanceof Error ? error.message : 'Не удалось загрузить фото.' });
    });
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [photoId, onClose]);

  return createPortal(
    <div className="plant-photo-lightbox" role="dialog" aria-modal="true" aria-label="Просмотр фотографии" onClick={onClose}>
      <button type="button" aria-label="Закрыть просмотр" onClick={onClose}>×</button>
      {photo?.id === photoId && (photo.error ? <span role="alert">{photo.error}</span> : <img src={photo.url} alt="Фотография проблемы растения" onClick={(event) => event.stopPropagation()} />)}
    </div>,
    document.body,
  );
}
