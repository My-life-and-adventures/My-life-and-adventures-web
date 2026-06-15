export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface ViewerInvitePreview {
  receiver_id: string;
  full_name: string;
  masked_email: string;
  storyteller_name: string;
}

export interface ViewerProfile {
  receiver_id: string;
  full_name: string;
  storyteller_name: string;
}

export interface ViewerStory {
  id: string;
  title: string;
  chapter: string;
  about: string | null;
  video_url: string;
  duration: number;
  status: string;
  publish_option: string;
  scheduled_date: string | null;
  created_at: string;
}
