'use client';
import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { CREATE_WORKFLOW, UPDATE_WORKFLOW, DELETE_WORKFLOW_STEPS, INSERT_WORKFLOW_STEPS, DELETE_WORKFLOW_TRIGGERS, INSERT_WORKFLOW_TRIGGERS } from '@/lib/graphql';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import StepConfigEditor from './StepConfigEditor';

interface Step {
  id: string;
  type: string;
  config: any;
  order_index: number;
}

interface Trigger {
  id: string;
  type: string;
  config: any;
}

interface Props {
  workflow?: any;
  orgId: string;
  userRole: string;
  onSaved?: (id: string) => void;
}

const SortableStep = ({ step, index, updateStep, removeStep, userRole }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: step.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [expanded, setExpanded] = useState(true);

  return (
    <div ref={setNodeRef} style={style} className="step-card card border rounded-lg p-4 bg-white shadow-sm mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div {...attributes} {...listeners} className="cursor-grab p-1 hover:bg-gray-100 rounded">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16"></path></svg>
          </div>
          <span className="badge">{index + 1}</span>
          <span className={`step-type-chip step-${step.type} font-medium px-2 py-1 rounded text-sm bg-blue-100 text-blue-800`}>{step.type}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-sm btn-ghost" onClick={() => setExpanded(!expanded)}>{expanded ? 'Collapse' : 'Expand'}</button>
          {userRole !== 'viewer' && (
             <button className="btn btn-sm btn-danger" onClick={() => removeStep(step.id)}>Delete</button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="pl-8">
          <StepConfigEditor type={step.type} config={step.config} onChange={(c) => updateStep(step.id, c)} userRole={userRole} />
        </div>
      )}
    </div>
  );
};

export default function WorkflowBuilder({ workflow, orgId, userRole, onSaved }: Props) {
  const [name, setName] = useState(workflow?.name || '');
  const [description, setDescription] = useState(workflow?.description || '');
  const [steps, setSteps] = useState<Step[]>(workflow?.steps || []);
  const [triggers, setTriggers] = useState<Trigger[]>(workflow?.triggers || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string|null>(null);

  const [createWorkflow] = useMutation(CREATE_WORKFLOW);
  const [updateWorkflow] = useMutation(UPDATE_WORKFLOW);
  const [deleteSteps] = useMutation(DELETE_WORKFLOW_STEPS);
  const [insertSteps] = useMutation(INSERT_WORKFLOW_STEPS);
  const [deleteTriggers] = useMutation(DELETE_WORKFLOW_TRIGGERS);
  const [insertTriggers] = useMutation(INSERT_WORKFLOW_TRIGGERS);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setSteps((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        return newItems.map((item, idx) => ({ ...item, order_index: idx }));
      });
    }
  };

  const addStep = (type: string) => {
    setSteps([...steps, { id: Date.now().toString(), type, config: {}, order_index: steps.length }]);
  };

  const updateStep = (id: string, config: any) => {
    setSteps(steps.map(s => s.id === id ? { ...s, config } : s));
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id).map((s, idx) => ({ ...s, order_index: idx })));
  };

  const addTrigger = (type: string) => {
    if (!triggers.find(t => t.type === type)) {
      setTriggers([...triggers, { id: Date.now().toString(), type, config: {} }]);
    }
  };

  const removeTrigger = (id: string) => {
    setTriggers(triggers.filter(t => t.id !== id));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      let wfId = workflow?.id;
      
      if (wfId) {
        await updateWorkflow({
          variables: {
            id: wfId,
            name,
            description,
            is_active: true
          }
        });
      } else {
        const res = await createWorkflow({
          variables: {
            org_id: orgId,
            name,
            description,
            is_active: true
          }
        });
        wfId = res.data.insert_workflows_one.id;
      }

      if (workflow?.id) {
        await deleteSteps({ variables: { workflow_id: wfId } });
        await deleteTriggers({ variables: { workflow_id: wfId } });
      }

      if (steps.length > 0) {
        await insertSteps({
          variables: {
            steps: steps.map((s, i) => ({
              workflow_id: wfId,
              type: s.type,
              config: s.config,
              order_index: i
            }))
          }
        });
      }

      if (triggers.length > 0) {
        await insertTriggers({
          variables: {
            triggers: triggers.map((t) => ({
              workflow_id: wfId,
              type: t.type,
              config: t.config
            }))
          }
        });
      }

      if (onSaved) onSaved(wfId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const disabled = userRole === 'viewer';

  return (
    <div className="flex flex-col gap-6">
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="card p-6 border rounded-lg bg-white shadow-sm flex flex-col gap-4">
        <input type="text" className="input w-full text-xl font-bold" placeholder="Workflow Name" value={name} onChange={e => setName(e.target.value)} disabled={disabled} />
        <textarea className="textarea w-full" placeholder="Workflow Description" value={description} onChange={e => setDescription(e.target.value)} disabled={disabled} rows={2}></textarea>
      </div>

      <div className="card p-6 border rounded-lg bg-white shadow-sm">
        <h3 className="text-lg font-bold mb-4">Steps</h3>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
            {steps.map((step, index) => (
              <SortableStep key={step.id} step={step} index={index} updateStep={updateStep} removeStep={removeStep} userRole={userRole} />
            ))}
          </SortableContext>
        </DndContext>

        {!disabled && (
          <div className="mt-4 flex flex-wrap gap-2">
            {['llm_call', 'http_request', 'conditional_branch', 'approval_gate'].map(t => (
              <button key={t} className="btn btn-secondary btn-sm" onClick={() => addStep(t)}>+ {t}</button>
            ))}
            {(userRole === 'owner' || userRole === 'editor') && ['db_write', 'notify'].map(t => (
              <button key={t} className="btn btn-secondary btn-sm" onClick={() => addStep(t)}>+ {t} {userRole === 'editor' ? '(Owner only)' : ''}</button>
            ))}
          </div>
        )}
      </div>

      <div className="card p-6 border rounded-lg bg-white shadow-sm">
        <h3 className="text-lg font-bold mb-4">Triggers</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {triggers.map(t => (
            <div key={t.id} className="badge badge-info flex items-center gap-2 p-2">
              {t.type}
              {!disabled && <button onClick={() => removeTrigger(t.id)} className="text-red-500 font-bold ml-2">x</button>}
            </div>
          ))}
        </div>
        {!disabled && (
          <div className="flex gap-2">
            {['manual', 'webhook', 'scheduled', 'db_event'].map(t => (
              <button key={t} className="btn btn-secondary btn-sm" onClick={() => addTrigger(t)}>+ {t}</button>
            ))}
          </div>
        )}
        {triggers.find(t => t.type === 'webhook') && (
           <div className="mt-4 p-4 bg-gray-50 rounded border text-sm font-mono break-all">
             Generated Webhook URL: https://jzslrsysqhsxqhljcmek.functions.ap-south-1.nhost.run/v1/webhook-trigger
           </div>
        )}
      </div>

      {!disabled && (
        <div className="flex justify-end">
          <button className="btn btn-primary btn-lg" onClick={save} disabled={saving}>
            {saving ? <span className="spinner"></span> : 'Save Workflow'}
          </button>
        </div>
      )}
    </div>
  );
}
