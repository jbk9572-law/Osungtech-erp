export type MessengerMessage = {
  id: string;
  sender_id: string | null;
  content: string;
  file_url: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
};
