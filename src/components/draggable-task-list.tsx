import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { ROW_GAP, ZONE_DELETE, ZONE_NONE, ZONE_NOT_TODAY, type DragState } from '@/components/drag-state';
import { TaskRow } from '@/components/task-row';
import { needsDecision, type Task } from '@/domain/planner';

export function useDragState(): DragState {
  const active = useSharedValue(-1);
  const hover = useSharedValue(-1);
  const offsetY = useSharedValue(0);
  const heights = useSharedValue<number[]>([]);
  const zone = useSharedValue(ZONE_NONE);
  return { active, hover, offsetY, heights, zone };
}

type Props = {
  tasks: Task[];
  drag: DragState;
  zoneTop: number;
  onToggle: (id: string) => void;
  onTomorrow: (id: string) => void;
  onMenu: (id: string) => void;
  onNotToday: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (id: string, toIndex: number) => void;
};

/** The open tasks of a day. Press and hold lifts a row; drop it between rows to reorder, or on a bottom target. */
export function DraggableTaskList({ tasks, drag, zoneTop, onToggle, onTomorrow, onMenu, onNotToday, onDelete, onReorder }: Props) {
  const measured = useRef<number[]>([]);
  const [dropTick, setDropTick] = useState(0);
  const [settling, setSettling] = useState(false);

  const onMeasured = useCallback(
    (index: number, height: number) => {
      if (measured.current[index] === height) return;
      measured.current[index] = height;
      drag.heights.set(measured.current.slice(0, tasks.length));
    },
    [drag.heights, tasks.length],
  );

  // Keep the measured list the same length as the task list.
  useEffect(() => {
    measured.current.length = tasks.length;
    drag.heights.set(measured.current.slice(0, tasks.length));
  }, [tasks.length, drag.heights]);

  // After a drop has been applied and React has re-rendered, clear the drag state without animating.
  useEffect(() => {
    if (dropTick === 0) return;
    drag.active.set(-1);
    drag.hover.set(-1);
    drag.offsetY.set(0);
    drag.zone.set(ZONE_NONE);
    const t = setTimeout(() => setSettling(false), 320);
    return () => clearTimeout(t);
  }, [dropTick, drag]);

  const onDrop = useCallback(
    (id: string, zone: number, toIndex: number) => {
      setSettling(true);
      if (zone === ZONE_NOT_TODAY) onNotToday(id);
      else if (zone === ZONE_DELETE) onDelete(id);
      else onReorder(id, toIndex);
      setDropTick((n) => n + 1);
    },
    [onNotToday, onDelete, onReorder],
  );

  return (
    <View style={{ gap: ROW_GAP }}>
      {tasks.map((task, index) => (
        <TaskRow
          key={task.id}
          task={task}
          index={index}
          flagged={needsDecision(task)}
          rank={index}
          drag={drag}
          zoneTop={zoneTop}
          animateLayout={!settling}
          onMeasured={onMeasured}
          onToggle={onToggle}
          onTomorrow={onTomorrow}
          onMenu={onMenu}
          onDrop={onDrop}
        />
      ))}
    </View>
  );
}
