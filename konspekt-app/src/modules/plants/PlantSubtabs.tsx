import { useStore } from '../../core/store';
import { archivedPlants } from '../../core/selectors';

export function PlantSubtabs({ plantId, photoCount = 0 }: { plantId: string | null; photoCount?: number }) {
  const { state, update } = useStore();
  const archiveCount = archivedPlants(state).length;

  const select = (view: typeof state.plantsView) => update((draft) => { draft.plantsView = view; });

  return (
    <div className="plants-subtabs">
      <button className={state.plantsView === 'watering' ? 'active' : ''} onClick={() => select('watering')}>Полив</button>
      <button className={state.plantsView === 'climate' ? 'active' : ''} onClick={() => select('climate')}>
        Климат <span>{state.environmentReadings.length}</span>
      </button>
      {plantId && (
        <button className={state.plantsView === 'gallery' ? 'active' : ''} onClick={() => select('gallery')}>
          Галерея <span>{photoCount}</span>
        </button>
      )}
      <button className={state.plantsView === 'archive' ? 'active' : ''} onClick={() => select('archive')}>
        Архив <span>{archiveCount}</span>
      </button>
    </div>
  );
}
