'use client';
import React from 'react';

type StepType = 'llm_call' | 'http_request' | 'db_write' | 'notify' | 'conditional_branch' | 'approval_gate';

interface Props {
  type: StepType;
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
  userRole: string;
}

export default function StepConfigEditor({ type, config, onChange, userRole }: Props) {
  const disabled = userRole === 'viewer';
  
  const handleChange = (field: string, value: any) => {
    onChange({ ...config, [field]: value });
  };

  if (type === 'llm_call') {
    return (
      <div className="flex flex-col gap-3">
        <select className="select w-full" value={config.model || ''} onChange={e => handleChange('model', e.target.value)} disabled={disabled}>
          <option value="">Select Model</option>
          <option value="llama3-8b-8192">Llama 3 8B (Groq)</option>
          <option value="llama3-70b-8192">Llama 3 70B (Groq)</option>
          <option value="mixtral-8x7b-32768">Mixtral 8x7B (Groq)</option>
        </select>
        <textarea className="textarea w-full" placeholder="System Prompt" value={config.system_prompt || ''} onChange={e => handleChange('system_prompt', e.target.value)} disabled={disabled} rows={3}></textarea>
        <textarea className="textarea w-full" placeholder="User Prompt" value={config.user_prompt || ''} onChange={e => handleChange('user_prompt', e.target.value)} disabled={disabled} rows={3}></textarea>
        <div className="flex gap-4 items-center">
          <label className="text-sm">Temperature:</label>
          <input type="number" className="input w-24" min="0.1" max="1.0" step="0.1" value={config.temperature || 0.7} onChange={e => handleChange('temperature', parseFloat(e.target.value))} disabled={disabled} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={config.json_mode || false} onChange={e => handleChange('json_mode', e.target.checked)} disabled={disabled} />
            JSON Mode
          </label>
        </div>
      </div>
    );
  }

  if (type === 'http_request') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <select className="select w-32" value={config.method || 'GET'} onChange={e => handleChange('method', e.target.value)} disabled={disabled}>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
          </select>
          <input type="text" className="input flex-1" placeholder="URL" value={config.url || ''} onChange={e => handleChange('url', e.target.value)} disabled={disabled} />
        </div>
        <textarea className="textarea w-full font-mono text-sm" placeholder="Headers (JSON)" value={config.headers || ''} onChange={e => handleChange('headers', e.target.value)} disabled={disabled} rows={3}></textarea>
        <textarea className="textarea w-full font-mono text-sm" placeholder="Body (JSON)" value={config.body || ''} onChange={e => handleChange('body', e.target.value)} disabled={disabled} rows={5}></textarea>
      </div>
    );
  }

  if (type === 'db_write') {
    return (
      <div className="flex flex-col gap-3">
        <textarea className="textarea w-full font-mono text-sm" placeholder="mutation InsertData($val: String!) {...}" value={config.mutation || ''} onChange={e => handleChange('mutation', e.target.value)} disabled={disabled} rows={5}></textarea>
        <textarea className="textarea w-full font-mono text-sm" placeholder="Variables (JSON)" value={config.variables || ''} onChange={e => handleChange('variables', e.target.value)} disabled={disabled} rows={3}></textarea>
      </div>
    );
  }

  if (type === 'notify') {
    return (
      <div className="flex flex-col gap-3">
        <input type="text" className="input w-full" placeholder="Webhook URL" value={config.webhook_url || ''} onChange={e => handleChange('webhook_url', e.target.value)} disabled={disabled} />
        <textarea className="textarea w-full" placeholder="Message (use {{lastOutput}} for data injection)" value={config.message || ''} onChange={e => handleChange('message', e.target.value)} disabled={disabled} rows={3}></textarea>
        <input type="text" className="input w-full" placeholder="Channel (optional)" value={config.channel || ''} onChange={e => handleChange('channel', e.target.value)} disabled={disabled} />
      </div>
    );
  }

  if (type === 'conditional_branch') {
    return (
      <div className="flex flex-col gap-3">
        <input type="text" className="input w-full font-mono text-sm" placeholder='Condition (e.g. lastOutput.sentiment === "positive")' value={config.condition || ''} onChange={e => handleChange('condition', e.target.value)} disabled={disabled} />
        <div className="flex items-center gap-2">
          <label className="text-sm">False Path Action:</label>
          <select className="select" value={config.false_path || 'continue'} onChange={e => handleChange('false_path', e.target.value)} disabled={disabled}>
            <option value="continue">Continue</option>
            <option value="stop">Stop</option>
          </select>
        </div>
      </div>
    );
  }

  if (type === 'approval_gate') {
    return (
      <div className="flex flex-col gap-3">
        <textarea className="textarea w-full" placeholder="Message for approvers" value={config.message || ''} onChange={e => handleChange('message', e.target.value)} disabled={disabled} rows={3}></textarea>
      </div>
    );
  }

  return <div>Unknown step type</div>;
}
