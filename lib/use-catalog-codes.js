'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { mergeCatalogCodes } from '@/lib/crypto-catalog';

// Suggestions include inactive records and retain configured values on older backends.
export function useCatalogCodes(resource, field, fallback = [], selected = []) {
  const [records, setRecords] = useState([]);
  const [error, setError] = useState(null);
  useEffect(() => {
    let current = true;
    setError(null);
    api[resource].options().then((rows) => {
      if (current) setRecords(rows);
    }).catch((err) => {
      if (current) setError(err.message || 'Unable to load catalogue options.');
    });
    return () => { current = false; };
  }, [resource]);
  return { options: mergeCatalogCodes(fallback, records.map((record) => record[field]), selected), error };
}
