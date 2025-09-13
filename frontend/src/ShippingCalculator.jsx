import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Truck, DollarSign, Zap, Plus, Minus, Calculator,
  TrendingDown, Box, CheckCircle, AlertTriangle, Info, Layers,
  BarChart3, Target, Cpu, Clock
} from 'lucide-react';
import axios from 'axios';

const API_URL = "http://localhost:3002";

const ShippingCalculator = () => {
  const [products, setProducts] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [shippingResult, setShippingResult] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [availableBoxes, setAvailableBoxes] = useState([]);
  const [comparisonData, setComparisonData] = useState(null);
  const [activeView, setActiveView] = useState('calculator'); // calculator, results, comparison
  const [error, setError] = useState(null);

  useEffect(() => {
    loadProducts();
    loadAvailableBoxes();
  }, []);

  const loadProducts = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/shipping/products`);
      if (response.data.success) {
        setProducts(response.data.products);
      }
    } catch (error) {
      console.warn('Could not load products:', error.message);
    }
  };

  const loadAvailableBoxes = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/shipping/boxes`);
      if (response.data.success) {
        setAvailableBoxes(response.data.boxes);
      }
    } catch (error) {
      console.warn('Could not load boxes:', error.message);
    }
  };

  const handleCalculateShipping = async () => {
    if (selectedItems.length === 0) {
      setError('Please select at least one product');
      return;
    }

    setCalculating(true);
    setError(null);

    try {
      const [shippingResponse, comparisonResponse] = await Promise.all([
        axios.post(`${API_URL}/api/shipping/calculate`, {
          items: selectedItems,
          destination: { country: 'US', postal_code: '10001', province: 'NY' }
        }),
        axios.post(`${API_URL}/api/shipping/compare`, {
          items: selectedItems,
          destination: { country: 'US', postal_code: '10001', province: 'NY' }
        })
      ]);

      setShippingResult(shippingResponse.data);
      setComparisonData(comparisonResponse.data);
      setActiveView('results');

    } catch (error) {
      console.error('Calculation failed:', error);
      setError(error.response?.data?.message || 'Shipping calculation failed');
    } finally {
      setCalculating(false);
    }
  };

  const handleRunTest = async () => {
    setCalculating(true);
    setError(null);

    try {
      const response = await axios.post(`${API_URL}/api/shipping/test`);
      setShippingResult(response.data);
      setActiveView('results');
    } catch (error) {
      setError('Test calculation failed');
    } finally {
      setCalculating(false);
    }
  };

  const addItem = (product) => {
    const existing = selectedItems.find(i => i.productId === product.productId);
    if (existing) {
      setSelectedItems(items =>
        items.map(i => i.productId === product.productId
          ? { ...i, quantity: i.quantity + 1 }
          : i
        )
      );
    } else {
      setSelectedItems(items => [...items, {
        productId: product.productId,
        quantity: 1,
        name: product.name
      }]);
    }
  };

  const removeItem = (productId) => {
    setSelectedItems(items => {
      const updated = items.map(i =>
        i.productId === productId && i.quantity > 1
          ? { ...i, quantity: i.quantity - 1 }
          : i
      ).filter(i => !(i.productId === productId && i.quantity <= 1));
      return updated;
    });
  };

  const clearSelection = () => {
    setSelectedItems([]);
    setShippingResult(null);
    setComparisonData(null);
    setError(null);
    setActiveView('calculator');
  };

  const totalItems = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="shipping-calculator"
      style={{
        maxWidth: '1200px',
        margin: '2rem auto',
        padding: '0 1rem',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      {/* Header */}
      <div className="header" style={{
        textAlign: 'center',
        marginBottom: '2rem',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '2rem',
        borderRadius: '12px'
      }}>
        <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 'bold' }}>
          🚀 AI-Powered Shipping Optimizer
        </h1>
        <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.2rem', opacity: 0.9 }}>
          NP-Hard 3D Bin Packing with Gemini AI Strategy
        </p>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '2rem',
          marginTop: '1rem',
          fontSize: '0.95rem'
        }}>
          <span>🔬 First Fit Decreasing Algorithm</span>
          <span>🧠 AI Packing Strategy</span>
          <span>💰 Cost Optimization</span>
        </div>
      </div>

      {/* View Switcher */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '1.5rem',
        borderRadius: '8px',
        background: '#f8f9fa',
        padding: '4px'
      }}>
        {[
          { id: 'calculator', label: 'Calculator', icon: Calculator },
          { id: 'results', label: 'Results', icon: BarChart3, disabled: !shippingResult },
          { id: 'comparison', label: 'Comparison', icon: Target, disabled: !comparisonData }
        ].map(view => {
          const IconComponent = view.icon;
          return (
            <button
              key={view.id}
              className={`view-tab ${activeView === view.id ? 'active' : ''}`}
              onClick={() => !view.disabled && setActiveView(view.id)}
              disabled={view.disabled}
              style={{
                flex: 1,
                padding: '12px 16px',
                border: 'none',
                borderRadius: '6px',
                background: activeView === view.id ? 'white' : 'transparent',
                color: view.disabled ? '#9ca3af' : activeView === view.id ? '#3b82f6' : '#6b7280',
                fontWeight: activeView === view.id ? '600' : '500',
                cursor: view.disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
            >
              <IconComponent size={18} />
              {view.label}
            </button>
          );
        })}
      </div>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#dc2626'
            }}
          >
            <AlertTriangle size={16} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calculator View */}
      {activeView === 'calculator' && (
        <div className="calculator-content">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            {/* Product Selection */}
            <div className="card" style={{
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '1.5rem',
              background: 'white'
            }}>
              <h3 style={{
                margin: '0 0 1rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#374151'
              }}>
                <Package size={20} />
                Available Products ({products.length})
              </h3>

              {products.length === 0 ? (
                <div style={{
                  padding: '2rem',
                  textAlign: 'center',
                  color: '#6b7280',
                  border: '2px dashed #d1d5db',
                  borderRadius: '8px'
                }}>
                  <Package size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
                  <p>No products available</p>
                  <p style={{ fontSize: '0.9rem' }}>Upload and analyze some products first!</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                  {products.map(product => {
                    const selected = selectedItems.find(i => i.productId === product.productId);
                    return (
                      <div
                        key={product.productId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          background: selected ? '#f0f9ff' : '#fafafa'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                            {product.name}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                            {product.dimensions?.length}"×{product.dimensions?.width}"×{product.dimensions?.height}" • {product.weight}lbs
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {selected && (
                            <>
                              <button
                                onClick={() => removeItem(product.productId)}
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  border: 'none',
                                  borderRadius: '6px',
                                  background: '#ef4444',
                                  color: 'white',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer'
                                }}
                              >
                                <Minus size={16} />
                              </button>
                              <span style={{
                                minWidth: '24px',
                                textAlign: 'center',
                                fontWeight: 'bold',
                                fontSize: '1.1rem'
                              }}>
                                {selected.quantity}
                              </span>
                            </>
                          )}
                          <button
                            onClick={() => addItem(product)}
                            style={{
                              width: '32px',
                              height: '32px',
                              border: 'none',
                              borderRadius: '6px',
                              background: '#22c55e',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Items & Actions */}
            <div className="card" style={{
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '1.5rem',
              background: 'white'
            }}>
              <h3 style={{
                margin: '0 0 1rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#374151'
              }}>
                <Truck size={20} />
                Selected Items ({totalItems})
              </h3>

              {selectedItems.length === 0 ? (
                <div style={{
                  padding: '2rem',
                  textAlign: 'center',
                  color: '#6b7280',
                  border: '2px dashed #d1d5db',
                  borderRadius: '8px'
                }}>
                  <Box size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
                  <p>No items selected</p>
                  <p style={{ fontSize: '0.9rem' }}>Add products to calculate optimal shipping</p>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '1.5rem' }}>
                    {selectedItems.map(item => (
                      <div
                        key={item.productId}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          marginBottom: '8px',
                          background: '#f8fafc',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0'
                        }}
                      >
                        <span style={{ fontWeight: '500' }}>{item.name}</span>
                        <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>×{item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gap: '12px' }}>
                    <button
                      onClick={handleCalculateShipping}
                      disabled={calculating}
                      style={{
                        width: '100%',
                        padding: '16px',
                        border: 'none',
                        borderRadius: '8px',
                        background: calculating ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                        color: 'white',
                        fontSize: '1.1rem',
                        fontWeight: '600',
                        cursor: calculating ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s'
                      }}
                    >
                      {calculating ? (
                        <>
                          <div className="spinner" style={{
                            width: '16px',
                            height: '16px',
                            border: '2px solid #ffffff40',
                            borderTop: '2px solid white',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                          }} />
                          Optimizing...
                        </>
                      ) : (
                        <>
                          <Zap size={20} />
                          Calculate Optimal Shipping
                        </>
                      )}
                    </button>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <button
                        onClick={handleRunTest}
                        disabled={calculating}
                        style={{
                          padding: '12px 16px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          background: 'white',
                          color: '#374151',
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <Cpu size={14} />
                        Run Test
                      </button>

                      <button
                        onClick={clearSelection}
                        style={{
                          padding: '12px 16px',
                          border: '1px solid #fca5a5',
                          borderRadius: '6px',
                          background: '#fef2f2',
                          color: '#dc2626',
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Available Boxes Info */}
          {availableBoxes.length > 0 && (
            <div className="card" style={{
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '1.5rem',
              marginTop: '2rem',
              background: 'white'
            }}>
              <h3 style={{
                margin: '0 0 1rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#374151'
              }}>
                <Layers size={20} />
                Available Shipping Boxes
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem'
              }}>
                {availableBoxes.map(box => (
                  <div
                    key={box.id}
                    style={{
                      padding: '12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      background: '#fafafa'
                    }}
                  >
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>{box.name}</div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px' }}>
                      {box.innerDimensions.length}" × {box.innerDimensions.width}" × {box.innerDimensions.height}"
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                      <span>Max: {box.maxWeight}lbs</span>
                      <span style={{ color: '#059669', fontWeight: '600' }}>${box.cost}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results View */}
      {activeView === 'results' && shippingResult && (
        <div className="results-content">
          <ResultsPanel result={shippingResult} />
        </div>
      )}

      {/* Comparison View */}
      {activeView === 'comparison' && comparisonData && (
        <div className="comparison-content">
          <ComparisonPanel comparison={comparisonData} />
        </div>
      )}
    </motion.div>
  );
};

// Results Panel Component
const ResultsPanel = ({ result }) => (
  <div style={{ display: 'grid', gap: '2rem' }}>
    {/* Summary Cards */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '1rem'
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="summary-card"
        style={{
          padding: '1.5rem',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: 'white',
          textAlign: 'center'
        }}
      >
        <DollarSign size={32} style={{ margin: '0 auto 0.5rem auto' }} />
        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>${result.totalCost}</div>
        <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Total Shipping Cost</div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="summary-card"
        style={{
          padding: '1.5rem',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
          color: 'white',
          textAlign: 'center'
        }}
      >
        <Package size={32} style={{ margin: '0 auto 0.5rem auto' }} />
        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{result.boxes?.length || 0}</div>
        <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Boxes Required</div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="summary-card"
        style={{
          padding: '1.5rem',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          color: 'white',
          textAlign: 'center'
        }}
      >
        <BarChart3 size={32} style={{ margin: '0 auto 0.5rem auto' }} />
        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{result.optimization?.volumeUtilization}%</div>
        <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Space Utilization</div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="summary-card"
        style={{
          padding: '1.5rem',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
          color: 'white',
          textAlign: 'center'
        }}
      >
        <TrendingDown size={32} style={{ margin: '0 auto 0.5rem auto' }} />
        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{result.optimization?.savings?.efficiency}</div>
        <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Efficiency Gain</div>
      </motion.div>
    </div>

    {/* Box Details */}
    <div className="card" style={{
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '1.5rem',
      background: 'white'
    }}>
      <h3 style={{
        margin: '0 0 1rem 0',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: '#374151'
      }}>
        <Box size={20} />
        Optimized Packing Plan
      </h3>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {result.boxes?.map((box, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            style={{
              padding: '1rem',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              background: '#f8fafc'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h4 style={{ margin: 0, color: '#374151' }}>Box {idx + 1}: {box.type}</h4>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem', color: '#6b7280' }}>
                <span>{box.items?.length || 0} items</span>
                <span>{box.weight?.toFixed(1)}lbs</span>
                <span style={{ color: '#059669', fontWeight: '600' }}>${box.cost}</span>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '1rem',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px' }}>Items:</div>
                <div style={{ fontSize: '0.9rem' }}>
                  {box.items?.map(item => item.name).join(', ') || 'No items'}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Utilization</div>
                <div style={{
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  color: box.utilization > 80 ? '#059669' : box.utilization > 60 ? '#f59e0b' : '#ef4444'
                }}>
                  {box.utilization}%
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>

    {/* Packing Instructions */}
    {result.packingInstructions && (
      <div className="card" style={{
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '1.5rem',
        background: 'white'
      }}>
        <h3 style={{
          margin: '0 0 1rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#374151'
        }}>
          <Info size={20} />
          AI-Generated Packing Instructions
        </h3>
        <div style={{
          background: '#f8fafc',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          whiteSpace: 'pre-wrap',
          fontSize: '0.9rem',
          lineHeight: '1.6'
        }}>
          {result.packingInstructions}
        </div>
      </div>
    )}

    {/* Algorithm Details */}
    {result.algorithmDetails && (
      <div className="card" style={{
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '1.5rem',
        background: 'white'
      }}>
        <h3 style={{
          margin: '0 0 1rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#374151'
        }}>
          <Cpu size={20} />
          Algorithm Performance
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          <div style={{
            padding: '1rem',
            background: '#f0f9ff',
            borderRadius: '8px',
            border: '1px solid #bae6fd'
          }}>
            <div style={{ fontSize: '0.85rem', color: '#0369a1', marginBottom: '4px' }}>Algorithm</div>
            <div style={{ fontWeight: '600', color: '#0c4a6e' }}>
              {result.algorithmDetails.algorithm}
            </div>
          </div>

          <div style={{
            padding: '1rem',
            background: '#f0fdf4',
            borderRadius: '8px',
            border: '1px solid #bbf7d0'
          }}>
            <div style={{ fontSize: '0.85rem', color: '#166534', marginBottom: '4px' }}>Processing Time</div>
            <div style={{ fontWeight: '600', color: '#14532d' }}>
              {result.algorithmDetails.optimizationTime}ms
            </div>
          </div>

          <div style={{
            padding: '1rem',
            background: '#fef7ff',
            borderRadius: '8px',
            border: '1px solid #f3e8ff'
          }}>
            <div style={{ fontSize: '0.85rem', color: '#7c3aed', marginBottom: '4px' }}>Iterations</div>
            <div style={{ fontWeight: '600', color: '#5b21b6' }}>
              {result.algorithmDetails.iterations}
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
);

// Comparison Panel Component
const ComparisonPanel = ({ comparison }) => (
  <div style={{ display: 'grid', gap: '2rem' }}>
    <h2 style={{
      margin: 0,
      textAlign: 'center',
      color: '#374151',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px'
    }}>
      <Target size={24} />
      Shipping Method Comparison
    </h2>

    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '1.5rem'
    }}>
      {['optimized', 'standard', 'individual'].map((method, idx) => {
        const data = comparison.comparison[method];
        const isRecommended = comparison.recommendation === 'optimized' && method === 'optimized';

        return (
          <motion.div
            key={method}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.2 }}
            className="comparison-card"
            style={{
              padding: '1.5rem',
              borderRadius: '12px',
              border: isRecommended ? '2px solid #10b981' : '1px solid #e5e7eb',
              background: isRecommended ? '#f0fdf4' : 'white',
              position: 'relative'
            }}
          >
            {isRecommended && (
              <div style={{
                position: 'absolute',
                top: '-1px',
                right: '1rem',
                background: '#10b981',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '0 0 8px 8px',
                fontSize: '0.75rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <CheckCircle size={12} />
                RECOMMENDED
              </div>
            )}

            <h3 style={{
              margin: '0 0 1rem 0',
              textTransform: 'capitalize',
              color: '#374151',
              fontSize: '1.3rem'
            }}>
              {method === 'optimized' ? '🚀 AI-Optimized' :
               method === 'standard' ? '📦 Standard' : '📋 Individual'}
            </h3>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#374151' }}>
                ${data.cost?.toFixed(2) || '0.00'}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                {data.description}
              </div>
            </div>

            <div style={{ display: 'grid', gap: '8px', marginBottom: '1rem' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: '#f8fafc',
                borderRadius: '6px',
                fontSize: '0.9rem'
              }}>
                <span>Boxes:</span>
                <span style={{ fontWeight: '600' }}>{data.boxes}</span>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: '#f8fafc',
                borderRadius: '6px',
                fontSize: '0.9rem'
              }}>
                <span>Utilization:</span>
                <span style={{
                  fontWeight: '600',
                  color: data.utilization > 80 ? '#059669' : data.utilization > 60 ? '#f59e0b' : '#ef4444'
                }}>
                  {data.utilization}%
                </span>
              </div>
            </div>

            {method !== 'optimized' && (
              <div style={{
                padding: '8px 12px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                fontSize: '0.85rem',
                color: '#dc2626',
                textAlign: 'center'
              }}>
                ${(data.cost - comparison.comparison.optimized.cost).toFixed(2)} more expensive
              </div>
            )}

            {method === 'optimized' && (
              <div style={{
                padding: '8px 12px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '6px',
                fontSize: '0.85rem',
                color: '#166534',
                textAlign: 'center'
              }}>
                Save {comparison.savings?.percentageSaved}% vs alternatives
              </div>
            )}
          </motion.div>
        );
      })}
    </div>

    {/* Savings Summary */}
    <div className="card" style={{
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '1.5rem',
      background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
      textAlign: 'center'
    }}>
      <h3 style={{
        margin: '0 0 1rem 0',
        color: '#0c4a6e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
      }}>
        <TrendingDown size={20} />
        Total Savings with AI Optimization
      </h3>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '1rem',
        marginTop: '1rem'
      }}>
        <div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#0369a1' }}>
            ${comparison.savings?.vsStandard}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#0c4a6e' }}>vs Standard Shipping</div>
        </div>

        <div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#0369a1' }}>
            ${comparison.savings?.vsIndividual}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#0c4a6e' }}>vs Individual Shipping</div>
        </div>

        <div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#0369a1' }}>
            {comparison.savings?.percentageSaved}%
          </div>
          <div style={{ fontSize: '0.85rem', color: '#0c4a6e' }}>Overall Efficiency</div>
        </div>
      </div>
    </div>
  </div>
);

// Add spinning animation for loading
const styles = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}

export default ShippingCalculator;