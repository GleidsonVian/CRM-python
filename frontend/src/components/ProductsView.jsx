import React, { useState, useEffect } from 'react';
import { API_URL } from '../config.js';
import { useAPI } from '../hooks/useAPI';
import { useConfirm } from '../App';

export default function ProductsView() {
  const confirm = useConfirm();
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', sku: '', price: 0, type: 'product', is_active: true });
  
  const { apiFetch } = useAPI();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const data = await apiFetch(`/products/`);
      setProducts(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const method = editingProduct ? 'PUT' : 'POST';
    const url = editingProduct ? `/products/${editingProduct.id}` : `/products/`;
    
    try {
      await apiFetch(url, {
        method,
        body: formData
      });
      setShowModal(false);
      setEditingProduct(null);
      setFormData({ name: '', description: '', sku: '', price: 0, type: 'product', is_active: true });
      fetchProducts();
    } catch (err) {
      alert("Erro ao salvar produto");
    }
  };

  const handleDelete = async (id) => {
    if (!await confirm('Excluir este produto?')) return;
    try {
      await apiFetch(`/products/${id}`, { method: 'DELETE' });
      fetchProducts();
    } catch (err) {
      console.error(err);
    }
  };

  const openNew = () => {
    setEditingProduct(null);
    setFormData({ name: '', description: '', sku: '', price: 0, type: 'product', is_active: true });
    setShowModal(true);
  };

  const openEdit = (prod) => {
    setEditingProduct(prod);
    setFormData({
      name: prod.name,
      description: prod.description || '',
      sku: prod.sku || '',
      price: prod.price || 0,
      type: prod.type || 'product',
      is_active: prod.is_active
    });
    setShowModal(true);
  };

  return (
    <div className="view-container fade-in">
      <div className="view-header">
        <div>
          <h2>Catálogo de Produtos e Serviços</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>Gerencie o portfólio para os orçamentos</p>
        </div>
        <div className="view-controls">
          <button className="btn btn-primary" onClick={openNew}>+ Novo Produto</button>
        </div>
      </div>

      <div className="view-body">
        {products.length === 0 ? (
          <div className="empty-state">
            Nenhum produto ou serviço cadastrado ainda.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>SKU</th>
                <th>Tipo</th>
                <th>Preço Base</th>
                <th>Status</th>
                <th style={{ width: 120 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{p.sku || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{p.type === 'service' ? 'Serviço' : 'Produto'}</td>
                  <td style={{ fontWeight: 500 }}>{Number(p.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td>
                    <span style={{ 
                      padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                      background: p.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: p.is_active ? '#10b981' : '#ef4444'
                    }}>
                      {p.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <button className="icon-btn" onClick={() => openEdit(p)}>✏️</button>
                    <button className="icon-btn" onClick={() => handleDelete(p.id)} style={{ color: '#ef4444', marginLeft: 8 }}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="overlay" onClick={() => setShowModal(false)}>
          <div className="small-modal" onClick={e => e.stopPropagation()} style={{ width: 500, maxWidth: '90vw' }}>
            <div className="small-modal-header">
              <span className="small-modal-title">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</span>
              <button className="icon-btn" onClick={() => setShowModal(false)}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="small-modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group" style={{ gridColumn: '1/3' }}>
                <label className="form-label">Nome do Produto/Serviço *</label>
                <input required autoFocus value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="form-input" />
              </div>
              
              <div className="form-group">
                <label className="form-label">SKU (Código)</label>
                <input value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Preço Base (R$)</label>
                <input type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})} className="form-input" />
              </div>

              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="form-input">
                  <option value="product">Produto Físico/Digital</option>
                  <option value="service">Serviço/Hora</option>
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 28 }}>
                <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} id="is_active_chk"/>
                <label htmlFor="is_active_chk" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>Ativo no Catálogo</label>
              </div>

              <div className="form-group" style={{ gridColumn: '1/3' }}>
                <label className="form-label">Descrição Opcional</label>
                <textarea rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="form-input"></textarea>
              </div>
              
              <div className="small-modal-footer" style={{ gridColumn: '1/3', display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
