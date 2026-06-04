export type RepairRequest = {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  deviceType: string;
  problemDescription: string;
  status: 'new' | 'in_progress' | 'done' | 'cancelled';
  assignedMaster?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateRepairRequest = {
  customerName: string;
  phone: string;
  address: string;
  deviceType: string;
  problemDescription: string;
};

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export async function getRepairRequests(): Promise<RepairRequest[]> {
  const response = await fetch(`${apiUrl}/repair-requests`);
  if (!response.ok) {
    throw new Error('Не удалось загрузить заявки');
  }

  return response.json();
}

export async function createRepairRequest(input: CreateRepairRequest): Promise<RepairRequest> {
  const response = await fetch(`${apiUrl}/repair-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error('Не удалось создать заявку');
  }

  return response.json();
}
