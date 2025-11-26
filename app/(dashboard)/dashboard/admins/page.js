'use client';

import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';

const emptyJson = (val) => (val ? val : '{\n  \n}');

export default function AdminsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const [createBody, setCreateBody] = useState(emptyJson());
  const [updateId, setUpdateId] = useState('');
  const [updateBody, setUpdateBody] = useState(emptyJson());
  const [changePwdBody, setChangePwdBody] = useState('{\n  "oldPassword": "",\n  "newPassword": ""\n}');

  const query = useMemo(() => new URLSearchParams({ page: String(page), size: String(size) }), [page, size]);

  const refresh = () => {
    setError(null);
    api.listAdmins(query)
      .then((data) => setRows(data?.content || []))
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    refresh();
  }, [page, size]);

  const parseJson = (text) => {
    try {
      return JSON.parse(text || '{}');
    } catch (err) {
      throw new Error('Invalid JSON payload');
    }
  };

  const handleCreate = async () => {
    setError(null);
    setInfo(null);
    try {
      await api.createAdmin(parseJson(createBody));
      setInfo('Admin created.');
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdate = async () => {
    if (!updateId) {
      setError('Provide admin ID to update.');
      return;
    }
    setError(null);
    setInfo(null);
    try {
      await api.updateAdmin(Number(updateId), parseJson(updateBody));
      setInfo('Admin updated.');
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    setError(null);
    setInfo(null);
    try {
      await api.deleteAdmin(id);
      setInfo(`Deleted admin ${id}.`);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResetPwd = async (id) => {
    setError(null);
    setInfo(null);
    try {
      const res = await api.resetAdminPassword(id);
      setInfo(`Reset password for admin ${id}. Response: ${JSON.stringify(res)}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleChangeMyPassword = async () => {
    setError(null);
    setInfo(null);
    try {
      await api.changeMyPassword(parseJson(changePwdBody));
      setInfo('Password changed.');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        <div>
          <label htmlFor="page">Page</label>
          <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="size">Size</label>
          <input id="size" type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </div>
        <div style={{ alignSelf: 'end' }}>
          <button type="button" onClick={refresh} style={{ width: '100%' }}>Refresh</button>
        </div>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 600 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 600 }}>{info}</div>}

      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontWeight: 700 }}>Create admin</div>
          <textarea value={createBody} onChange={(e) => setCreateBody(e.target.value)} rows={10} />
          <button type="button" onClick={handleCreate}>Create</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontWeight: 700 }}>Update admin</div>
          <input placeholder="Admin ID" value={updateId} onChange={(e) => setUpdateId(e.target.value)} />
          <textarea value={updateBody} onChange={(e) => setUpdateBody(e.target.value)} rows={9} />
          <button type="button" onClick={handleUpdate}>Update</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontWeight: 700 }}>Change my password</div>
          <textarea value={changePwdBody} onChange={(e) => setChangePwdBody(e.target.value)} rows={9} />
          <button type="button" onClick={handleChangeMyPassword}>Change password</button>
        </div>
      </div>

      <DataTable
        columns={[
          { key: 'id', label: 'ID' },
          { key: 'email', label: 'Email' },
          { key: 'role', label: 'Role' },
          { key: 'active', label: 'Active' },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => handleResetPwd(row.id)}>Reset pwd</button>
                <button type="button" onClick={() => handleDelete(row.id)} style={{ color: '#b91c1c' }}>Delete</button>
              </div>
            )
          }
        ]}
        rows={rows}
        emptyLabel="No admins found"
      />
    </div>
  );
}
