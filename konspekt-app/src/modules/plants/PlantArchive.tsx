import { useEffect, useState } from 'react';
import { useStore } from '../../core/store';
import { archivedPlants, dayCountLabel, latestPlantPhotoId, plantTimelineStats } from '../../core/selectors';
import { getPlantPhoto } from '../../core/plantPhotoStorage';
import { ArchiveIcon } from '../../ui/icons';
import { PlantSubtabs } from './PlantSubtabs';

export function PlantArchive() {
  const { state, update } = useStore();
  const plants = archivedPlants(state);

  return (
    <>
      <div className="topbar plant-archive-topbar">
        <div className="subject-title-wrap">
          <ArchiveIcon />
          <h1 className="subject-title">Библиотека растений</h1>
        </div>
      </div>
      <div className="searchbar plant-archive-toolbar">
        <PlantSubtabs plantId={null} />
        <label className="plant-archive-sort">
          <span>Сортировка</span>
          <select
            value={state.plantsArchiveSort}
            onChange={(e) => {
              const sort = e.target.value;
              if (sort === 'archived' || sort === 'name' || sort === 'age') {
                update((draft) => { draft.plantsArchiveSort = sort; });
              }
            }}
          >
            <option value="archived">Сначала недавно архивированные</option>
            <option value="name">По названию</option>
            <option value="age">По возрасту</option>
          </select>
        </label>
      </div>
      <div className="content-scroll plant-archive-grid">
        {plants.length ? plants.map((plant) => (
          <ArchivePlantCard
            key={plant.id}
            name={plant.name}
            ageDays={plantTimelineStats(state, plant.id).ageDays}
            photoId={latestPlantPhotoId(state, plant.id)}
            onClick={() => update((draft) => {
              draft.activePlantId = plant.id;
              draft.plantsView = 'watering';
              draft.plantsSearch = '';
            })}
          />
        )) : (
          <div className="empty-state plant-archive-empty">
            <span className="display">Архив пока пуст</span>
            Архивированные растения появятся здесь.
          </div>
        )}
      </div>
    </>
  );
}

function ArchivePlantCard({ name, ageDays, photoId, onClick }: { name: string; ageDays: number | null; photoId: string | null; onClick: () => void }) {
  const [loadedPhoto, setLoadedPhoto] = useState<{ id: string | null; url: string | null; error: string }>({
    id: null,
    url: null,
    error: '',
  });
  const photoUrl = loadedPhoto.id === photoId ? loadedPhoto.url : null;
  const photoError = loadedPhoto.id === photoId ? loadedPhoto.error : '';

  useEffect(() => {
    if (!photoId) return;

    let active = true;
    let url: string | null = null;
    void getPlantPhoto(photoId).then((blob) => {
      if (!blob) throw new Error('Фото не найдено в локальном хранилище. Восстановите его из ZIP-бэкапа.');
      url = URL.createObjectURL(blob);
      if (active) setLoadedPhoto({ id: photoId, url, error: '' });
      else URL.revokeObjectURL(url);
    }).catch((error: unknown) => {
      if (active) setLoadedPhoto({
        id: photoId,
        url: null,
        error: error instanceof Error ? error.message : 'Не удалось загрузить фотографию.',
      });
    });

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [photoId]);

  return (
    <button type="button" className="plant-archive-card" onClick={onClick}>
      <span className="plant-archive-photo">
        {photoUrl ? <img src={photoUrl} alt={`Последнее фото растения «${name}»`} /> : (
          <span className={photoError ? 'plant-archive-photo-placeholder error' : 'plant-archive-photo-placeholder'} role={photoError ? 'alert' : undefined}>
            {photoError || 'Нет фото'}
          </span>
        )}
      </span>
      <span className="plant-archive-card-copy">
        <strong>{name}</strong>
        <small>{ageDays === null ? 'Возраст не указан' : `Возраст · ${dayCountLabel(ageDays)}`}</small>
      </span>
    </button>
  );
}
