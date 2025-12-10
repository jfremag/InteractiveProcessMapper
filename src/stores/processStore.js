import { defineStore } from 'pinia';

const STORAGE_KEY = 'bpmnProcesses';

export const defaultBpmn = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Start" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="186" y="81" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

function generateId() {
  return 'proc-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Process shape (plain JS object, not TypeScript):
// {
//   id: string,
//   name: string,
//   area: string | null,
//   parentId: string | null,
//   status: 'draft' | 'published',
//   version: number,
//   createdAt: string (ISO),
//   updatedAt: string (ISO),
//   bpmnXml: string,
// }

function normalizeProcess(raw) {
  const now = new Date().toISOString();
  const updatedAt = raw?.updatedAt || now;
  const createdAt = raw?.createdAt || updatedAt;
  const status = raw?.status === 'published' ? 'published' : 'draft';
  const versionNumber = Number(raw?.version);

  return {
    id: raw?.id || generateId(),
    name: raw?.name || 'Untitled process',
    area: raw?.area ?? null,
    parentId: raw?.parentId ?? null,
    status,
    version: Number.isFinite(versionNumber) && versionNumber > 0 ? versionNumber : 1,
    createdAt,
    updatedAt,
    bpmnXml: raw?.bpmnXml || defaultBpmn,
  };
}

export const useProcessStore = defineStore('processStore', {
  state: () => ({
    processes: [],
    selectedProcess: null,
    loading: false,
    error: null,
  }),
  actions: {
    loadFromStorage() {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this.processes = parsed.map((item) => normalizeProcess(item));
          } else {
            this.processes = [];
          }
        } catch (err) {
          console.error('Failed to parse processes', err);
          this.processes = [];
        }
      } else {
        this.processes = [];
      }
    },
    saveToStorage() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.processes));
    },
    init() {
      this.loadFromStorage();
    },
    getProcessById(id) {
      return this.processes.find((p) => p.id === id) || null;
    },
    createProcess(name = 'New process') {
      const now = new Date().toISOString();
      const newProcess = {
        id: generateId(),
        name,
        area: null,
        parentId: null,
        status: 'draft',
        version: 1,
        createdAt: now,
        updatedAt: now,
        bpmnXml: defaultBpmn,
      };
      this.processes.push(newProcess);
      this.saveToStorage();
      return newProcess;
    },
    updateProcess(id, { name, area, parentId, status, bpmnXml }) {
      const existing = this.getProcessById(id);
      if (!existing) return;
      if (name !== undefined) existing.name = name;
      if (area !== undefined) existing.area = area;
      if (parentId !== undefined) existing.parentId = parentId;
      if (status !== undefined) {
        const previousStatus = existing.status;
        existing.status = status === 'published' ? 'published' : 'draft';
        if (existing.status === 'published' && previousStatus !== 'published') {
          existing.version = (existing.version || 1) + 1;
        }
      }
      if (bpmnXml !== undefined) existing.bpmnXml = bpmnXml;
      existing.updatedAt = new Date().toISOString();
      this.saveToStorage();
    },
    deleteProcess(id) {
      this.processes = this.processes.filter((p) => p.id !== id);
      if (this.selectedProcess?.id === id) {
        this.selectedProcess = null;
      }
      this.saveToStorage();
    },
    setSelectedProcess(id) {
      this.selectedProcess = this.getProcessById(id);
    },
    importProcessFromFile(name, bpmnXml) {
      const now = new Date().toISOString();
      const imported = {
        id: generateId(),
        name: name || 'Imported process',
        area: null,
        parentId: null,
        status: 'draft',
        version: 1,
        createdAt: now,
        updatedAt: now,
        bpmnXml,
      };
      this.processes.push(imported);
      this.saveToStorage();
      return imported;
    },
    exportProcessToBlob(id) {
      const proc = this.getProcessById(id);
      if (!proc) return null;
      return new Blob([proc.bpmnXml], { type: 'text/xml' });
    },
  },
});
