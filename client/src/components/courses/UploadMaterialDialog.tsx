import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { Upload, FileText, X, Loader2, CheckCircle } from 'lucide-react';
import { uploadMaterial } from '@/services';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface UploadMaterialDialogProps {
  courseId: string;
  chapterId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];

export function UploadMaterialDialog({
  courseId,
  chapterId,
  open,
  onOpenChange,
  onSuccess,
}: UploadMaterialDialogProps) {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadMaterial(courseId, chapterId, file, setUploadProgress),
    onSuccess: () => {
      toast.success(t('materials.uploadSuccess'));
      setSelectedFile(null);
      setUploadProgress(0);
      onSuccess();
    },
    onError: () => {
      toast.error(t('materials.uploadError'));
      setUploadProgress(0);
    },
  });

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return t('materials.errors.fileTooLarge');
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return t('materials.errors.invalidType');
    }
    return null;
  }, [t]);

  const handleFileSelect = useCallback((file: File) => {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    setSelectedFile(file);
  }, [validateFile]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!uploadMutation.isPending) {
      setSelectedFile(null);
      setUploadProgress(0);
      onOpenChange(isOpen);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('materials.uploadTitle')}</DialogTitle>
          <DialogDescription>{t('materials.uploadDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop Zone */}
          {!selectedFile && !uploadMutation.isPending && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-1">{t('materials.dropzone.title')}</p>
              <p className="text-xs text-muted-foreground mb-4">
                {t('materials.dropzone.subtitle', { types: ALLOWED_EXTENSIONS.join(', ') })}
              </p>
              <input
                type="file"
                accept={ALLOWED_EXTENSIONS.join(',')}
                onChange={handleInputChange}
                className="hidden"
                id="file-upload"
              />
              <Button asChild variant="outline" size="sm">
                <label htmlFor="file-upload" className="cursor-pointer">
                  {t('materials.dropzone.browse')}
                </label>
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                {t('materials.dropzone.maxSize', { size: '50MB' })}
              </p>
            </div>
          )}

          {/* Selected File */}
          {selectedFile && !uploadMutation.isPending && (
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="p-2 bg-muted rounded-lg">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedFile(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Upload Progress */}
          {uploadMutation.isPending && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="p-2 bg-muted rounded-lg">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{selectedFile?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('materials.uploading')}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t('materials.progress')}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            </div>
          )}

          {/* Success State */}
          {uploadMutation.isSuccess && (
            <div className="flex items-center gap-4 p-4 border border-green-200 bg-green-50 rounded-lg">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-green-900">{t('materials.uploadComplete')}</p>
                <p className="text-sm text-green-700">{t('materials.processingStarted')}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={uploadMutation.isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploadMutation.isPending}
          >
            {uploadMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t('materials.upload')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
