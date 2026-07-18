import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CrmCustomList,
  CrmCustomListRepository,
} from "./model";

interface UseCrmCustomListsOptions {
  repository: CrmCustomListRepository;
  workspaceId: string;
  actorId: string;
}

export function useCrmCustomLists({
  repository,
  workspaceId,
  actorId,
}: UseCrmCustomListsOptions) {
  const [lists, setLists] = useState<CrmCustomList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLists(await repository.list(workspaceId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load custom lists");
    } finally {
      setLoading(false);
    }
  }, [repository, workspaceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = useCallback(async (values: { displayName: string; description: string }) => {
    setError(null);
    try {
      const created = await repository.create({
        workspaceId,
        actorId,
        ...values,
      });
      setLists((current) => [created, ...current]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create custom list");
    }
  }, [actorId, repository, workspaceId]);

  const update = useCallback(async (id: string, values: { displayName: string; description: string }) => {
    setError(null);
    try {
      const updated = await repository.update(id, { actorId, ...values });
      setLists((current) => current.map((item) => item.id === id ? updated : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update custom list");
    }
  }, [actorId, repository]);

  const archive = useCallback(async (id: string) => {
    setError(null);
    try {
      await repository.archive(id, actorId);
      setLists((current) => current.filter((item) => item.id !== id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to archive custom list");
    }
  }, [actorId, repository]);

  return useMemo(() => ({
    lists,
    loading,
    error,
    reload,
    create,
    update,
    archive,
  }), [archive, create, error, lists, loading, reload, update]);
}
