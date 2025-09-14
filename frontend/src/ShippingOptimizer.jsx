import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Package,
  Truck,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Box,
  Zap,
  Calculator,
  RotateCcw
} from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:3003';

const ShippingOptimizer = ({ cartItems = [], onShippingSelect }) => {
  const [optimizationResult, setOptimizationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedOption, setSelectedOption] = useState('optimized');

  // Sample cart items for demo (tote bags + LEGO set)
  const sampleCartItems = [
    {
      id: 'tote-bag',
      name: 'Canvas Tote Bag',
      productType: 'bag',
      dimensions: { length: 15, width: 12, height: 6 },
      estimatedWeight: 0.8,
      material: 'canvas',
      quantity: 3,
      price: 25.00
    },
    {
      id: 'lego-set',
      name: 'LEGO Architecture Set',
      productType: 'toy',
      dimensions: { length: 18, width: 14, height: 3 },
      estimatedWeight: 2.5,
      material: 'plastic',
      quantity: 1,
      price: 79.99
    }
  ];

  const items = cartItems.length > 0 ? cartItems : sampleCartItems;

  useEffect(() => {
    if (items.length > 0) {
      optimizeShipping();
    }
  }, [items]);

  const optimizeShipping = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('🚀 Optimizing shipping for:', items);

      // For demo, use the test endpoint
      const response = await axios.post(`${API_URL}/api/shipping/test-advanced`);

      if (response.data.success) {
        setOptimizationResult(response.data);
        console.log('✅ Shipping optimization result:', response.data);
      } else {
        throw new Error('Optimization failed');
      }
    } catch (err) {
      console.error('❌ Shipping optimization error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to optimize shipping');
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (optionId) => {
    setSelectedOption(optionId);
    if (onShippingSelect) {
      const option = optimizationResult?.results?.advanced?.checkoutDisplay?.options?.find(opt => opt.id === optionId);
      onShippingSelect(option);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
        <div className="loading-animation" style={{ marginBottom: '16px' }}>
          <RotateCcw size={32} className="spin" style={{ color: 'var(--brand)' }} />
        </div>
        <p className="label">Optimizing shipping costs...</p>
        <p className="muted" style={{ fontSize: '14px' }}>
          🤖 AI is calculating the most efficient packing for your items
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ padding: '24px', borderColor: '#ef4444', background: '#fef2f2' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', marginBottom: '12px' }}>
          <AlertCircle size={20} />
          <p className="label" style={{ color: '#dc2626', margin: 0 }}>Shipping Optimization Error</p>
        </div>
        <p style={{ fontSize: '14px', color: '#7f1d1d', margin: '0 0 16px 0' }}>{error}</p>
        <button className="btn" onClick={optimizeShipping}>Try Again</button>
      </div>
    );
  }

  if (!optimizationResult) {
    return null;
  }

  const { results } = optimizationResult;
  const shippingOptions = results.advanced?.checkoutDisplay?.options || [];
  const recommendation = results.advanced?.checkoutDisplay?.recommendation;

  return (
    <div className="shipping-optimizer">
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div className="icon-box" style={{ background: 'var(--brand)', border: 'none' }}>
            <Package size={20} style={{ color: '#ffffff' }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Shipping Options</h3>
            <p className="muted" style={{ margin: '2px 0 0 0', fontSize: '14px' }}>
              AI-optimized packaging for your {items.length} item types
            </p>
          </div>
        </div>

        {/* Shipping Options */}
        <div className="shipping-options" style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}>
          {shippingOptions.map((option) => (
            <motion.div
              key={option.id}
              className={`shipping-option ${selectedOption === option.id ? 'selected' : ''}`}
              style={{
                border: `2px solid ${selectedOption === option.id ? 'var(--brand)' : 'var(--border)'}`,
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                background: selectedOption === option.id ? 'var(--chip)' : '#ffffff',
                position: 'relative'
              }}
              onClick={() => handleOptionSelect(option.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Recommended Badge */}
              {option.recommended && (
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'var(--brand)',
                  color: '#ffffff',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  RECOMMENDED
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '24px' }}>{option.icon}</div>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>
                      {option.name}
                    </div>
                    <div style={{ color: 'var(--text-weak)', fontSize: '14px' }}>
                      {option.description}
                    </div>
                    {option.estimatedDelivery && (
                      <div style={{ color: 'var(--text-weak)', fontSize: '12px', marginTop: '2px' }}>
                        📅 {option.estimatedDelivery}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--brand)' }}>
                    ${option.cost.toFixed(2)}
                  </div>
                  {option.savings && (
                    <div style={{ color: '#059669', fontSize: '12px', fontWeight: '600' }}>
                      {option.savings}
                    </div>
                  )}
                </div>
              </div>

              {/* Option Details */}
              {selectedOption === option.id && option.details && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  style={{
                    marginTop: '16px',
                    paddingTop: '16px',
                    borderTop: '1px solid var(--border)'
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                    <div>
                      <strong>Total Weight:</strong> {option.details.totalWeight}
                    </div>
                    <div>
                      <strong>Algorithm:</strong> {option.details.algorithm}
                    </div>
                  </div>

                  {option.details.boxes && (
                    <div style={{ marginTop: '12px' }}>
                      <strong style={{ fontSize: '14px' }}>Packing Details:</strong>
                      <div style={{ marginTop: '8px', display: 'grid', gap: '4px' }}>
                        {option.details.boxes.map((box, i) => (
                          <div key={i} style={{
                            fontSize: '13px',
                            color: 'var(--text-weak)',
                            padding: '6px 8px',
                            background: 'var(--bg-weak)',
                            borderRadius: '6px'
                          }}>
                            📦 {box}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Selection indicator */}
              {selectedOption === option.id && (
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  background: 'var(--brand)',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <CheckCircle size={12} style={{ color: '#ffffff' }} />
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Algorithm Information */}
        <div style={{
          background: 'var(--bg-weak)',
          padding: '16px',
          borderRadius: '12px',
          border: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Calculator size={16} style={{ color: 'var(--brand)' }} />
            <span style={{ fontSize: '14px', fontWeight: '600' }}>Optimization Details</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px' }}>
            <div>
              <div style={{ color: 'var(--text-weak)' }}>Algorithm Used:</div>
              <div style={{ fontWeight: '600' }}>{results.advanced?.algorithmDetails?.approach}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-weak)' }}>Optimization:</div>
              <div style={{ fontWeight: '600' }}>{results.advanced?.algorithmDetails?.optimization}</div>
            </div>
          </div>

          {results.advanced?.algorithmDetails?.features && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-weak)', marginBottom: '6px' }}>
                Key Features:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {results.advanced.algorithmDetails.features.map((feature, i) => (
                  <span key={i} className="chip" style={{ fontSize: '11px', padding: '2px 6px' }}>
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Comparison Savings */}
        {results.comparison && results.comparison.savings !== '0.00' && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: '#f0fdf4',
            borderRadius: '8px',
            border: '1px solid #22c55e'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d' }}>
              <DollarSign size={16} />
              <span style={{ fontWeight: '600' }}>
                {parseFloat(results.comparison.savings) > 0
                  ? `Save $${results.comparison.savings} (${results.comparison.percentSaved})`
                  : `Cost: $${Math.abs(parseFloat(results.comparison.savings)).toFixed(2)} more for optimization`
                }
              </span>
            </div>
            <div style={{ fontSize: '13px', color: '#166534', marginTop: '4px' }}>
              vs {results.comparison.efficiency}
            </div>
          </div>
        )}

        {/* Recommendation */}
        {recommendation && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: '#f0f9ff',
            borderRadius: '8px',
            border: '1px solid #0ea5e9'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0369a1' }}>
              <Zap size={16} />
              <span style={{ fontWeight: '600' }}>AI Recommendation</span>
            </div>
            <div style={{ fontSize: '13px', color: '#0c4a6e', marginTop: '4px' }}>
              {recommendation.reason}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .shipping-option:hover {
          box-shadow: 0 4px 12px rgba(0,128,96,0.1);
        }

        .shipping-option.selected {
          box-shadow: 0 4px 20px rgba(0,128,96,0.15);
        }
      `}</style>
    </div>
  );
};

export default ShippingOptimizer;