import api from './api';

// ============ TYPES ============

export interface Course {
  id: string;
  userId: string;
  title: string;
  name?: string; // For backward compatibility
  description?: string;
  syllabus?: string;
  language: 'en' | 'fr';
  color?: string;
  chapterCount: number;
  completedChapters: number;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface CourseWithProgress extends Course {
  chapters?: Chapter[];
}

export interface CreateCourseData {
  title: string;
  description?: string;
  syllabus?: string;
  language?: 'en' | 'fr';
  color?: string;
}

export interface UpdateCourseData {
  title?: string;
  description?: string;
  syllabus?: string;
  language?: 'en' | 'fr';
  color?: string;
}

export interface Chapter {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  orderIndex: number;
  status: 'draft' | 'processing' | 'ready' | 'completed';
  processedContent?: string;
  processedAt?: string;
  completedAt?: string;
  materialCount: number;
  processedMaterials: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChapterData {
  title: string;
  description?: string;
  orderIndex?: number;
}

export interface UpdateChapterData {
  title?: string;
  description?: string;
  status?: 'draft' | 'processing' | 'ready' | 'completed';
}

export interface CoursesResponse {
  courses: Course[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface Material {
  id: string;
  chapterId: string;
  originalFilename: string;
  storedFilename: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
  extractedText?: string;
  structuredContent?: string;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessingStage {
  stage: string;
  message: string;
  percentage: number;
  timestamp: number;
}

export interface ProcessingResult {
  success: boolean;
  materialId: string;
  stages: ProcessingStage[];
  extractedTextLength: number;
  chunksCreated: number;
  embeddingsGenerated: number;
  structuredContent?: string | {
    title?: string;
    summary?: string;
    sections?: Array<{ title: string; content: string }>;
    keyPoints?: string[];
  } | null;
  error: string | null;
  processingTimeMs: number;
}

export interface MaterialResult {
  id: string;
  originalName: string;
  status: Material['status'];
  processingProgress: number;
  processingError: string | null;
  extractedTextPreview: string | null;
  extractedTextLength: number;
  structuredContent?: ProcessingResult['structuredContent'];
  processedAt: string | null;
}

// ============ COURSE API ============

export async function getCourses(): Promise<CoursesResponse> {
  const response = await api.get('/courses');
  return response.data.data;
}

export async function getCourse(courseId: string): Promise<Course> {
  const response = await api.get(`/courses/${courseId}`);
  return response.data.data;
}

export async function getCourseWithProgress(courseId: string): Promise<CourseWithProgress> {
  const response = await api.get(`/courses/${courseId}/progress`);
  return response.data.data;
}

export async function createCourse(data: CreateCourseData): Promise<Course> {
  const response = await api.post('/courses', data);
  return response.data.data;
}

export async function updateCourse(courseId: string, data: UpdateCourseData): Promise<Course> {
  const response = await api.put(`/courses/${courseId}`, data);
  return response.data.data;
}

export async function deleteCourse(courseId: string): Promise<void> {
  await api.delete(`/courses/${courseId}`);
}

// ============ CHAPTER API ============

export async function getChapters(courseId: string): Promise<Chapter[]> {
  const response = await api.get(`/courses/${courseId}/chapters`);
  return response.data.data;
}

export async function getChapter(courseId: string, chapterId: string): Promise<Chapter> {
  const response = await api.get(`/courses/${courseId}/chapters/${chapterId}`);
  return response.data.data;
}

export async function createChapter(courseId: string, data: CreateChapterData): Promise<Chapter> {
  const response = await api.post(`/courses/${courseId}/chapters`, data);
  return response.data.data;
}

export async function updateChapter(
  courseId: string,
  chapterId: string,
  data: UpdateChapterData
): Promise<Chapter> {
  const response = await api.put(`/courses/${courseId}/chapters/${chapterId}`, data);
  return response.data.data;
}

export async function deleteChapter(courseId: string, chapterId: string): Promise<void> {
  await api.delete(`/courses/${courseId}/chapters/${chapterId}`);
}

export async function reorderChapters(courseId: string, chapterIds: string[]): Promise<void> {
  await api.put(`/courses/${courseId}/chapters/reorder`, { chapterIds });
}

export async function markChapterComplete(courseId: string, chapterId: string): Promise<Chapter> {
  const response = await api.post(`/courses/${courseId}/chapters/${chapterId}/complete`);
  return response.data.data;
}

// ============ MATERIAL API ============

export async function getMaterials(courseId: string, chapterId: string): Promise<Material[]> {
  const response = await api.get(`/courses/${courseId}/chapters/${chapterId}/materials`);
  return response.data.data;
}

export async function getMaterial(
  courseId: string,
  chapterId: string,
  materialId: string
): Promise<Material> {
  const response = await api.get(
    `/courses/${courseId}/chapters/${chapterId}/materials/${materialId}`
  );
  return response.data.data;
}

export async function uploadMaterial(
  courseId: string,
  chapterId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<Material> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post(
    `/courses/${courseId}/chapters/${chapterId}/materials`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    }
  );
  return response.data.data;
}

export async function getMaterialStatus(
  courseId: string,
  chapterId: string,
  materialId: string
): Promise<{ id: string; status: Material['status']; file_name: string }> {
  const response = await api.get(
    `/courses/${courseId}/chapters/${chapterId}/materials/${materialId}/status`
  );
  return response.data.data;
}

export async function deleteMaterial(
  courseId: string,
  chapterId: string,
  materialId: string
): Promise<void> {
  await api.delete(`/courses/${courseId}/chapters/${chapterId}/materials/${materialId}`);
}

/**
 * Start synchronous processing for a material
 * This is a blocking call - will wait until processing completes
 */
export async function processMaterial(
  courseId: string,
  chapterId: string,
  materialId: string
): Promise<ProcessingResult> {
  const response = await api.post(
    `/courses/${courseId}/chapters/${chapterId}/materials/${materialId}/process`,
    {},
    {
      timeout: 300000, // 5 minute timeout for processing
    }
  );
  return response.data.data;
}

/**
 * Reset a material to pending status (allows reprocessing)
 */
export async function resetMaterial(
  courseId: string,
  chapterId: string,
  materialId: string
): Promise<Material> {
  const response = await api.post(
    `/courses/${courseId}/chapters/${chapterId}/materials/${materialId}/reset`
  );
  return response.data.data;
}

/**
 * Get detailed processing result for a material
 */
export async function getMaterialResult(
  courseId: string,
  chapterId: string,
  materialId: string
): Promise<MaterialResult> {
  const response = await api.get(
    `/courses/${courseId}/chapters/${chapterId}/materials/${materialId}/result`
  );
  return response.data.data;
}
