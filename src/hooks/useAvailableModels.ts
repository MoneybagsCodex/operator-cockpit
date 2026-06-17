'use client';

import { useEffect, useState } from 'react';

export interface ModelOption {
  value: string;
  label: string;
  submodels?: { value: string; label: string }[];
}

const DEFAULT: ModelOption[] = [{ value: 'sonnet', label: 'Sonnet' }];

export function useAvailableModels(): ModelOption[] {
  const [models, setModels] = useState<ModelOption[]>(DEFAULT);

  useEffect(() => {
    fetch('/api/agents/models')
      .then((r) => r.json())
      .then((data: ModelOption[]) => { if (data.length) setModels(data); })
      .catch(() => {});
  }, []);

  return models;
}
