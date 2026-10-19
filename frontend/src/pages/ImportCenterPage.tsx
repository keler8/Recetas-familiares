import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Folder, UploadCloud, Instagram, Sparkles, Check,
  AlertCircle, Trash2, Edit3, ArrowRight, CheckCircle2,
  Clock, FileText, ChevronRight, HelpCircle, X, RefreshCw,
  Search, Users, HardDrive, ArrowLeft, Image as ImageIcon,
  FileCode, Layers, Eye, Plus, Camera, Link as LinkIcon,
  Wand2, ChefHat, Save, ExternalLink
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { ConnectorInfoModal } from '../components/ConnectorInfoModal';

type DriveSection = 'my_drive' | 'shared_with_me' | 'shared_drives';

export const ImportCenterPage: React.FC = () => {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [instagramUrl, setInstagramUrl] = useState('');
  const [isImportingIg, setIsImportingIg] = useState(false);
  const [driveStatus, setDriveStatus] = useState<any>(null);
  const [showDriveModal, setShowDriveModal] = useState(false);

  // Drive state
  const [driveBanner, setDriveBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showDriveExplorer, setShowDriveExplorer] = useState(false);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [loadingDriveFiles, setLoadingDriveFiles] = useState(false);
  const [importingDriveFileId, setImportingDriveFileId] = useState<string | null>(null);
  const [importingFolderId, setImportingFolderId] = useState<string | null>(null);
  const [isApprovingAll, setIsApprovingAll] = useState(false);


  // Advanced Explorer state (Search, Shared with me, Shared Drives, Breadcrumbs)
  const [driveSection, setDriveSection] = useState<DriveSection>('my_drive');
  const [folderHistory, setFolderHistory] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedSharedDrive, setSelectedSharedDrive] = useState<{ id: string; name: string } | null>(null);
  const [sharedDrivesList, setSharedDrivesList] = useState<any[]>([]);
  const [loadingSharedDrives, setLoadingSharedDrives] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  // Draft Review & Edit Modal state
  const [editingDraft, setEditingDraft] = useState<any | null>(null);
  const [draftForm, setDraftForm] = useState<{
    title: string;
    proposed_image_url: string;
    source_url: string;
    dish_type: string;
    cuisine: string;
    difficulty: string;
    prep_time_min: number;
    cook_time_min: number;
    base_servings: number;
    nutrition_calories: number | string;
    nutrition_protein: number | string;
    nutrition_carbs: number | string;
    nutrition_fat: number | string;
    description: string;
    ingredients: Array<{ name: string; amount: number | string | null; unit: string; notes?: string }>;
    steps: Array<{ step_number: number; instruction: string; timer_minutes?: number | string }>;
  }>({
    title: '',
    proposed_image_url: '',
    source_url: '',
    dish_type: 'Plato principal',
    cuisine: 'Mediterránea',
    difficulty: 'media',
    prep_time_min: 15,
    cook_time_min: 20,
    base_servings: 4,
    nutrition_calories: '',
    nutrition_protein: '',
    nutrition_carbs: '',
    nutrition_fat: '',
    description: '',
    ingredients: [],
    steps: []
  });
  const [suggestedImages, setSuggestedImages] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showImageSuggestions, setShowImageSuggestions] = useState(false);
  const [imageSearchInput, setImageSearchInput] = useState('');
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [showCustomUrlInput, setShowCustomUrlInput] = useState(false);
  const [customImageUrlInput, setCustomImageUrlInput] = useState('');
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isEstimatingDraftNutrition, setIsEstimatingDraftNutrition] = useState(false);

  const handleEstimateDraftNutrition = async () => {
    if (!draftForm.title.trim() && draftForm.ingredients.length === 0) {
      alert('Introduce el título o añade ingredientes para estimar las calorías.');
      return;
    }
    setIsEstimatingDraftNutrition(true);
    try {
      const res = await apiRequest('/recipes/estimate-nutrition', {
        method: 'POST',
        body: JSON.stringify({
          title: draftForm.title.trim() || 'Receta',
          ingredients: draftForm.ingredients.filter(i => i.name.trim()),
          base_servings: Number(draftForm.base_servings || 4),
          dish_type: draftForm.dish_type
        })
      });
      if (res) {
        setDraftForm(prev => ({
          ...prev,
          nutrition_calories: res.calories ?? prev.nutrition_calories,
          nutrition_protein: res.protein ?? prev.nutrition_protein,
          nutrition_carbs: res.carbs ?? prev.nutrition_carbs,
          nutrition_fat: res.fat ?? prev.nutrition_fat,
        }));
      }
    } catch (err: any) {
      alert(`Error al estimar nutrición con IA: ${err.message || err}`);
    } finally {
      setIsEstimatingDraftNutrition(false);
    }
  };
  const [reformattingDraftId, setReformattingDraftId] = useState<number | null>(null);
  const [isReformattingDraft, setIsReformattingDraft] = useState(false);
  const [isReformattingAll, setIsReformattingAll] = useState(false);
  const draftImageFileInputRef = useRef<HTMLInputElement>(null);

  const fetchBatches = async () => {
    try {
      const data = await apiRequest('/imports/batches');
      setBatches(data);
      if (data.length > 0 && !selectedBatch) {
        setSelectedBatch(data[0]);
      }
    } catch (err) {
      console.warn('Error fetching import batches:', err);
    }
  };

  const fetchDriveStatus = async () => {
    try {
      const data = await apiRequest('/drive/status');
      setDriveStatus(data);
    } catch (err) {
      console.warn('Error checking drive:', err);
    }
  };

  useEffect(() => {
    fetchBatches();
    fetchDriveStatus();
  }, []);

  // Auto-poll if any batch is currently processing
  useEffect(() => {
    const hasProcessing = selectedBatch?.status === 'processing' || batches.some(b => b.status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(async () => {
      try {
        const freshBatches = await apiRequest('/imports/batches');
        setBatches(freshBatches);
        if (selectedBatch) {
          const freshCurrent = freshBatches.find((b: any) => b.id === selectedBatch.id);
          if (freshCurrent) {
            setSelectedBatch(freshCurrent);
          }
        }
      } catch (e) {
        console.warn('Error polling batches:', e);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [selectedBatch?.id, selectedBatch?.status, batches]);

  useEffect(() => {
    const connected = searchParams.get('drive_connected');
    const email = searchParams.get('email');
    const error = searchParams.get('drive_error');

    if (connected === '1') {
      setDriveBanner({
        type: 'success',
        message: `¡Google Drive vinculado con éxito${email ? ` (${decodeURIComponent(email)})` : ''}! Ya puedes explorar e importar tus recetas.`
      });
      setSearchParams({}, { replace: true });
      fetchDriveStatus();
    } else if (error) {
      setDriveBanner({
        type: 'error',
        message: `Error al conectar con Google Drive: ${decodeURIComponent(error)}`
      });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  const fetchDriveFiles = async (
    section: DriveSection = driveSection,
    folderId?: string | null,
    driveId?: string | null,
    queryText?: string
  ) => {
    setLoadingDriveFiles(true);
    try {
      const params = new URLSearchParams();
      params.set('section', section === 'shared_drives' ? 'shared_drive' : section);
      if (folderId) params.set('folder_id', folderId);
      if (driveId) params.set('drive_id', driveId);
      if (queryText && queryText.trim()) params.set('query', queryText.trim());

      const files = await apiRequest<any[]>(`/drive/files?${params.toString()}`);
      setDriveFiles(files || []);
    } catch (err: any) {
      console.warn('Error fetching drive files:', err);
      setDriveFiles([]);
    } finally {
      setLoadingDriveFiles(false);
    }
  };

  const fetchSharedDrives = async () => {
    setLoadingSharedDrives(true);
    try {
      const drives = await apiRequest<any[]>('/drive/shared-drives');
      setSharedDrivesList(drives || []);
    } catch (err: any) {
      console.warn('Error fetching shared drives:', err);
      setSharedDrivesList([]);
    } finally {
      setLoadingSharedDrives(false);
    }
  };

  const openDriveExplorer = async () => {
    setShowDriveExplorer(true);
    setDriveSection('my_drive');
    setFolderHistory([]);
    setSelectedSharedDrive(null);
    setSearchQuery('');
    setActiveSearch('');
    fetchDriveFiles('my_drive', null, null, '');
    fetchSharedDrives();
  };

  const handleSectionChange = (section: DriveSection) => {
    setDriveSection(section);
    setFolderHistory([]);
    setSelectedSharedDrive(null);
    setSearchQuery('');
    setActiveSearch('');
    if (section === 'shared_drives') {
      fetchSharedDrives();
      setDriveFiles([]);
    } else {
      fetchDriveFiles(section, null, null, '');
    }
  };

  const handleEnterFolder = (folder: { id: string; name: string }) => {
    setFolderHistory(prev => [...prev, folder]);
    setSearchQuery('');
    setActiveSearch('');
    fetchDriveFiles(driveSection, folder.id, selectedSharedDrive?.id || null, '');
  };

  const handleEnterSharedDrive = (drive: { id: string; name: string }) => {
    setSelectedSharedDrive(drive);
    setFolderHistory([]);
    setSearchQuery('');
    setActiveSearch('');
    fetchDriveFiles('shared_drives', null, drive.id, '');
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      // Go to root of section or shared drive
      setFolderHistory([]);
      fetchDriveFiles(driveSection, null, selectedSharedDrive?.id || null, activeSearch);
    } else {
      const targetFolder = folderHistory[index];
      setFolderHistory(prev => prev.slice(0, index + 1));
      fetchDriveFiles(driveSection, targetFolder.id, selectedSharedDrive?.id || null, activeSearch);
    }
  };

  const handleBackStep = () => {
    if (folderHistory.length > 0) {
      handleBreadcrumbClick(folderHistory.length - 2);
    } else if (selectedSharedDrive) {
      setSelectedSharedDrive(null);
      setDriveFiles([]);
      fetchSharedDrives();
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setActiveSearch(searchQuery.trim());
    const currentFolderId = folderHistory.length > 0 ? folderHistory[folderHistory.length - 1].id : null;
    fetchDriveFiles(driveSection, currentFolderId, selectedSharedDrive?.id || null, searchQuery.trim());
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setActiveSearch('');
    const currentFolderId = folderHistory.length > 0 ? folderHistory[folderHistory.length - 1].id : null;
    fetchDriveFiles(driveSection, currentFolderId, selectedSharedDrive?.id || null, '');
  };

  const handleImportDriveFile = async (file: any) => {
    setImportingDriveFileId(file.id);
    try {
      const newBatch = await apiRequest('/drive/import-file', {
        method: 'POST',
        body: JSON.stringify({
          file_id: file.id,
          file_name: file.name,
          mime_type: file.mimeType,
          web_view_link: file.webViewLink
        })
      });
      setShowDriveExplorer(false);
      await fetchBatches();
      setSelectedBatch(newBatch);
    } catch (err: any) {
      alert(`Error al importar archivo de Google Drive: ${err.message || err}`);
    } finally {
      setImportingDriveFileId(null);
    }
  };

  const handleImportDriveFolder = async (folder: { id: string; name: string }, autoApprove: boolean = false) => {
    setImportingFolderId(folder.id);
    try {
      const newBatch = await apiRequest('/drive/import-folder', {
        method: 'POST',
        body: JSON.stringify({
          folder_id: folder.id,
          folder_name: folder.name,
          drive_id: selectedSharedDrive?.id || null,
          auto_approve: autoApprove
        })
      });
      setShowDriveExplorer(false);
      setSelectedBatch(newBatch);
      await fetchBatches();
      setDriveBanner({
        type: 'success',
        message: `Importando carpeta "${folder.name}" en segundo plano con IA. Las recetas irán apareciendo a continuación conforme se extraen.`
      });
    } catch (err: any) {
      alert(`Error al importar carpeta de Google Drive: ${err.message || err}`);
    } finally {
      setImportingFolderId(null);
    }
  };

  const handleApproveAllDrafts = async () => {
    if (!selectedBatch) return;
    setIsApprovingAll(true);
    try {
      const updated = await apiRequest(`/imports/batches/${selectedBatch.id}/approve-all`, {
        method: 'POST'
      });
      await fetchBatches();
      setSelectedBatch(updated);
      setDriveBanner({
        type: 'success',
        message: '¡Todas las recetas del lote han sido aprobadas y publicadas en tu biblioteca!'
      });
    } catch (err: any) {
      alert(`Error al aprobar recetas: ${err.message || err}`);
    } finally {
      setIsApprovingAll(false);
    }
  };

  const handleDisconnectDrive = async () => {

    if (!confirm('¿Deseas desvincular tu cuenta de Google Drive?')) return;
    try {
      await apiRequest('/drive/disconnect', { method: 'POST' });
      await fetchDriveStatus();
      setDriveBanner({
        type: 'success',
        message: 'Google Drive se ha desvinculado correctamente.'
      });
    } catch (err: any) {
      alert(`Error al desconectar: ${err.message || err}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const newBatch = await apiRequest('/imports/upload', {
        method: 'POST',
        body: formData
      });
      await fetchBatches();
      setSelectedBatch(newBatch);
    } catch (err: any) {
      alert(`Error al procesar archivo: ${err.message || err}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleInstagramImport = async () => {
    if (!instagramUrl.trim()) return;
    setIsImportingIg(true);
    try {
      const newBatch = await apiRequest('/imports/instagram', {
        method: 'POST',
        body: JSON.stringify({ url: instagramUrl })
      });
      setInstagramUrl('');
      await fetchBatches();
      setSelectedBatch(newBatch);
    } catch (err: any) {
      alert(`Error importando Instagram: ${err.message || err}`);
    } finally {
      setIsImportingIg(false);
    }
  };

  const reviewDraft = async (
    draftId: number, 
    action: 'approve' | 'discard' | 'update_existing',
    targetRecipeId?: number
  ) => {
    try {
      await apiRequest(`/imports/drafts/${draftId}/review`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          target_recipe_id: targetRecipeId
        })
      });
      await fetchBatches();
      if (selectedBatch) {
        const updated = await apiRequest(`/imports/batches/${selectedBatch.id}`);
        setSelectedBatch(updated);
      }
    } catch (err: any) {
      alert(`Error al revisar borrador: ${err.message || err}`);
    }
  };

  const openDraftEditor = async (draft: any) => {
    setEditingDraft(draft);
    const ex = draft.extracted_json || {};

    const rawIngs = ex.ingredients || [];
    const parsedIngs = rawIngs.map((i: any) => {
      if (typeof i === 'string') return { name: i, amount: 1, unit: 'ud' };
      return {
        name: i.name || 'Ingrediente',
        amount: i.amount !== undefined && i.amount !== null ? i.amount : '',
        unit: i.unit || 'ud',
        notes: i.notes || ''
      };
    });

    const rawSteps = ex.steps || [];
    const parsedSteps = rawSteps.map((s: any, idx: number) => {
      if (typeof s === 'string') return { step_number: idx + 1, instruction: s, timer_minutes: '' };
      return {
        step_number: s.step_number || idx + 1,
        instruction: s.instruction || '',
        timer_minutes: s.timer_seconds ? Math.round(s.timer_seconds / 60) : ''
      };
    });

    setDraftForm({
      title: draft.title || '',
      proposed_image_url: draft.proposed_image_url || draft.source_image_url || '',
      source_url: draft.source_url || '',
      dish_type: ex.dish_type || 'Plato principal',
      cuisine: ex.cuisine || 'Mediterránea',
      difficulty: ex.difficulty || 'media',
      prep_time_min: Number(ex.prep_time_min || 15),
      cook_time_min: Number(ex.cook_time_min || 20),
      base_servings: Number(ex.base_servings || 4),
      nutrition_calories: ex.nutrition_calories !== undefined && ex.nutrition_calories !== null ? ex.nutrition_calories : '',
      nutrition_protein: ex.nutrition_protein !== undefined && ex.nutrition_protein !== null ? ex.nutrition_protein : '',
      nutrition_carbs: ex.nutrition_carbs !== undefined && ex.nutrition_carbs !== null ? ex.nutrition_carbs : '',
      nutrition_fat: ex.nutrition_fat !== undefined && ex.nutrition_fat !== null ? ex.nutrition_fat : '',
      description: ex.description || '',
      ingredients: parsedIngs,
      steps: parsedSteps
    });

    setShowImageSuggestions(false);
    setShowCustomUrlInput(false);
    setCustomImageUrlInput('');
    setImageSearchInput(draft.title || '');

    setLoadingSuggestions(true);
    try {
      const data = await apiRequest<{ candidates: string[] }>(`/imports/drafts/${draft.id}/suggest-images`);
      setSuggestedImages(data?.candidates || []);
    } catch (e) {
      console.warn('Could not load suggestions:', e);
      setSuggestedImages([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSearchImagesOnline = async (searchQuery?: string) => {
    if (!editingDraft) return;
    const q = searchQuery !== undefined ? searchQuery : imageSearchInput;
    if (!q || !q.trim()) return;
    setIsSearchingImages(true);
    try {
      const data = await apiRequest<{ candidates: string[] }>(
        `/imports/drafts/${editingDraft.id}/suggest-images?query=${encodeURIComponent(q.trim())}`
      );
      setSuggestedImages(data?.candidates || []);
      setShowImageSuggestions(true);
    } catch (e) {
      console.warn('Could not search images online:', e);
    } finally {
      setIsSearchingImages(false);
    }
  };

  const handleSaveDraftChanges = async (
    approveAfter: boolean = false,
    reviewAction: 'approve' | 'update_existing' = 'approve'
  ) => {
    if (!editingDraft) return;
    setIsSavingDraft(true);
    try {
      const updatedExtracted = {
        ...(editingDraft.extracted_json || {}),
        title: draftForm.title.trim(),
        description: draftForm.description.trim(),
        dish_type: draftForm.dish_type,
        cuisine: draftForm.cuisine.trim(),
        difficulty: draftForm.difficulty,
        prep_time_min: Number(draftForm.prep_time_min || 0),
        cook_time_min: Number(draftForm.cook_time_min || 0),
        total_time_min: Number(draftForm.prep_time_min || 0) + Number(draftForm.cook_time_min || 0),
        base_servings: Number(draftForm.base_servings || 4),
        nutrition_calories: draftForm.nutrition_calories !== '' && draftForm.nutrition_calories !== null ? Number(draftForm.nutrition_calories) : null,
        nutrition_protein: draftForm.nutrition_protein !== '' && draftForm.nutrition_protein !== null ? Number(draftForm.nutrition_protein) : null,
        nutrition_carbs: draftForm.nutrition_carbs !== '' && draftForm.nutrition_carbs !== null ? Number(draftForm.nutrition_carbs) : null,
        nutrition_fat: draftForm.nutrition_fat !== '' && draftForm.nutrition_fat !== null ? Number(draftForm.nutrition_fat) : null,
        ingredients: draftForm.ingredients.map((ing, idx) => ({
          name: ing.name.trim(),
          amount: ing.amount !== '' && ing.amount !== null ? Number(ing.amount) : null,
          unit: ing.unit.trim(),
          notes: ing.notes ? ing.notes.trim() : null,
          order_index: idx
        })),
        steps: draftForm.steps.map((st, idx) => ({
          step_number: idx + 1,
          instruction: st.instruction.trim(),
          timer_seconds: st.timer_minutes ? Number(st.timer_minutes) * 60 : null
        }))
      };

      const updatedDraft = await apiRequest(`/imports/drafts/${editingDraft.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: draftForm.title.trim(),
          proposed_image_url: draftForm.proposed_image_url.trim(),
          source_url: draftForm.source_url ? draftForm.source_url.trim() : null,
          extracted_json: updatedExtracted
        })
      });

      if (approveAfter) {
        await apiRequest(`/imports/drafts/${editingDraft.id}/review`, {
          method: 'POST',
          body: JSON.stringify({
            action: reviewAction,
            target_recipe_id: editingDraft.existing_recipe_id || undefined,
            modified_data: updatedExtracted
          })
        });
        setEditingDraft(null);
      } else {
        setEditingDraft(updatedDraft);
      }

      await fetchBatches();
      if (selectedBatch) {
        const fresh = await apiRequest(`/imports/batches/${selectedBatch.id}`);
        setSelectedBatch(fresh);
      }
    } catch (err: any) {
      alert(`Error al guardar cambios: ${err.message || err}`);
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleReformatSingleDraft = async (draftId: number) => {
    setReformattingDraftId(draftId);
    setIsReformattingDraft(true);
    try {
      const updated = await apiRequest(`/imports/drafts/${draftId}/reformat-with-ai`, {
        method: 'POST'
      });
      if (editingDraft && editingDraft.id === draftId) {
        openDraftEditor(updated);
      }
      await fetchBatches();
      if (selectedBatch) {
        const fresh = await apiRequest(`/imports/batches/${selectedBatch.id}`);
        setSelectedBatch(fresh);
      }
      setDriveBanner({
        type: 'success',
        message: `¡Receta "${updated.title}" re-analizada y formateada con éxito con Gemini IA!`
      });
    } catch (err: any) {
      alert(`Error al re-formatear con Gemini IA: ${err.message || err}`);
    } finally {
      setIsReformattingDraft(false);
      setReformattingDraftId(null);
    }
  };

  const handleReformatAllBatch = async () => {
    if (!selectedBatch) return;
    const confirmRun = window.confirm(
      `¿Deseas re-analizar y formatear las recetas pendientes de este lote con Gemini IA? Esto mejorará títulos, tiempos e imágenes.`
    );
    if (!confirmRun) return;

    setIsReformattingAll(true);
    try {
      const freshBatch = await apiRequest(`/imports/batches/${selectedBatch.id}/reformat-all`, {
        method: 'POST'
      });
      setSelectedBatch(freshBatch);
      await fetchBatches();
      setDriveBanner({
        type: 'success',
        message: '¡Lote formateado con éxito usando Gemini IA!'
      });
    } catch (err: any) {
      alert(`Error al re-analizar lote: ${err.message || err}`);
    } finally {
      setIsReformattingAll(false);
    }
  };

  const handleUploadDraftCustomImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingDraft) return;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiRequest(`/imports/drafts/${editingDraft.id}/upload-image`, {
        method: 'POST',
        body: formData
      });
      setDraftForm(prev => ({ ...prev, proposed_image_url: res.proposed_image_url }));
      setEditingDraft(res);
      await fetchBatches();
      if (selectedBatch) {
        const fresh = await apiRequest(`/imports/batches/${selectedBatch.id}`);
        setSelectedBatch(fresh);
      }
    } catch (err: any) {
      alert(`Error al subir imagen: ${err.message || err}`);
    }
  };

  const handleSelectSuggestedImage = (url: string) => {
    setDraftForm(prev => ({ ...prev, proposed_image_url: url }));
  };

  const handleApplyCustomImageUrl = () => {
    if (!customImageUrlInput.trim()) return;
    setDraftForm(prev => ({ ...prev, proposed_image_url: customImageUrlInput.trim() }));
    setShowCustomUrlInput(false);
    setCustomImageUrlInput('');
  };

  const handleAddIngredient = () => {
    setDraftForm(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { name: '', amount: 1, unit: 'g', notes: '' }]
    }));
  };

  const handleRemoveIngredient = (index: number) => {
    setDraftForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, idx) => idx !== index)
    }));
  };

  const handleUpdateIngredient = (index: number, field: string, value: any) => {
    setDraftForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, idx) => idx === index ? { ...ing, [field]: value } : ing)
    }));
  };

  const handleAddStep = () => {
    setDraftForm(prev => ({
      ...prev,
      steps: [...prev.steps, { step_number: prev.steps.length + 1, instruction: '', timer_minutes: '' }]
    }));
  };

  const handleRemoveStep = (index: number) => {
    setDraftForm(prev => ({
      ...prev,
      steps: prev.steps.filter((_, idx) => idx !== index).map((s, idx) => ({ ...s, step_number: idx + 1 }))
    }));
  };

  const handleUpdateStep = (index: number, field: string, value: any) => {
    setDraftForm(prev => ({
      ...prev,
      steps: prev.steps.map((st, idx) => idx === index ? { ...st, [field]: value } : st)
    }));
  };

  const getFileIcon = (mimeType: string = '') => {
    if (mimeType.includes('folder')) return <Folder className="w-5 h-5 text-amber-400 shrink-0" />;
    if (mimeType.includes('pdf')) return <FileText className="w-5 h-5 text-rose-400 shrink-0" />;
    if (mimeType.includes('image')) return <ImageIcon className="w-5 h-5 text-emerald-400 shrink-0" />;
    if (mimeType.includes('document')) return <FileText className="w-5 h-5 text-blue-400 shrink-0" />;
    return <FileText className="w-5 h-5 text-zinc-400 shrink-0" />;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.webp,.txt"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Centro de importación</h1>
        <p className="text-xs text-zinc-400 mt-0.5">Diseño funcional propuesto</p>
      </div>

      {/* Dynamic Feedback Banner */}
      {driveBanner && (
        <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
          driveBanner.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {driveBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span className="font-medium">{driveBanner.message}</span>
          </div>
          <button
            onClick={() => setDriveBanner(null)}
            className="text-zinc-400 hover:text-white text-xs font-bold px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Two Big Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Google Drive Card */}
        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col justify-between space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <Folder className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">{t('google_drive')}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  driveStatus?.is_authorized
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : driveStatus?.is_configured
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {driveStatus?.is_authorized
                    ? 'Vinculado'
                    : driveStatus?.is_configured
                      ? 'Listo para conectar'
                      : 'Pendiente OAuth'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">{t('drive_hint')}</p>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs border-t border-zinc-800/80">
            <div className="text-zinc-400 text-xs">
              {driveStatus?.is_authorized ? (
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate max-w-[150px]">{driveStatus.account_email || 'Cuenta vinculada'}</span>
                </span>
              ) : (
                <span>{driveStatus?.status || 'Comprobando...'}</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {driveStatus?.is_authorized ? (
                <>
                  <button
                    onClick={openDriveExplorer}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/20 active:scale-95"
                  >
                    <Folder className="w-3.5 h-3.5" />
                    <span>Explorar Drive</span>
                  </button>
                  <button
                    onClick={handleDisconnectDrive}
                    className="px-2 py-1 rounded-lg text-zinc-500 hover:text-rose-400 text-[11px] transition-colors"
                    title="Desvincular cuenta"
                  >
                    Desconectar
                  </button>
                </>
              ) : driveStatus?.is_configured ? (
                <>
                  <a
                    href="/api/drive/login?return_to=/imports"
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/20 active:scale-95"
                  >
                    <Folder className="w-3.5 h-3.5" />
                    <span>Conectar mi Drive</span>
                  </a>
                  <button
                    onClick={() => setShowDriveModal(true)}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs flex items-center gap-1 transition-colors border border-zinc-700/60"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Ayuda</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowDriveModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-400 hover:text-emerald-300 font-semibold text-xs flex items-center gap-1.5 transition-colors border border-zinc-700/60"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>¿Cómo conectar?</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Subir archivos Card */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 hover:bg-zinc-900/80 transition-all flex flex-col justify-between text-left space-y-4 group"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{t('upload_files')}</h3>
              <p className="text-xs text-zinc-400 mt-0.5">{t('upload_hint')}</p>
            </div>
          </div>
          <div className="pt-2 flex items-center text-xs font-bold text-amber-400">
            <span>{isUploading ? 'Procesando con OCR e IA...' : 'Seleccionar archivo local'}</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </div>
        </button>
      </div>

      {/* Instagram Importer Bar */}
      <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
        <div className="flex items-center gap-2">
          <Instagram className="w-4 h-4 text-rose-400" />
          <h3 className="text-sm font-bold text-white">Importar desde Instagram Reel o Vídeo</h3>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={instagramUrl}
            onChange={(e) => setInstagramUrl(e.target.value)}
            placeholder="Pega la URL del post o reel (ej. https://www.instagram.com/reel/...)"
            className="flex-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-rose-500"
          />
          <button
            onClick={handleInstagramImport}
            disabled={isImportingIg || !instagramUrl}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-xs disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {isImportingIg ? 'Analizando audio...' : t('import_btn')}
          </button>
        </div>
      </div>


      {/* Batch Selector if multiple batches exist */}
      {batches.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <span className="text-xs font-bold text-zinc-400 shrink-0">Lotes recientes:</span>
          {batches.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelectedBatch(b)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                selectedBatch?.id === b.id
                  ? 'bg-amber-500 text-zinc-950 shadow-sm'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
              }`}
            >
              {b.status === 'processing' && (
                <div className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              )}
              <span className="truncate max-w-[150px]">{b.source_name || b.source_type}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedBatch?.id === b.id ? 'bg-zinc-950/20 text-zinc-900' : 'bg-zinc-800 text-zinc-400'
              }`}>
                {b.total_detected || 0}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Processed Batch Progress Card */}
      {selectedBatch ? (
        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-white">Lote: {selectedBatch.source_name || selectedBatch.source_type}</h3>
                {selectedBatch.status === 'processing' ? (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1.5 animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                    <span>Procesando con IA...</span>
                  </span>
                ) : selectedBatch.status === 'pending_review' ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Pendiente de revisión
                  </span>
                ) : selectedBatch.status === 'completed' ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Completado
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                    {selectedBatch.status}
                  </span>
                )}
                {selectedBatch.source_url && (
                  <a
                    href={selectedBatch.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-950/40 hover:bg-blue-900/60 border border-blue-500/30 text-blue-300 text-[10px] font-semibold transition-colors"
                    title="Abrir lote en Google Drive"
                  >
                    <ExternalLink className="w-3 h-3 text-blue-400" />
                    <span>Ver en Drive</span>
                  </a>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {selectedBatch.total_detected} {t('recipes_identified')}
              </p>
            </div>
            <span className="text-xs font-mono text-zinc-400">
              {new Date(selectedBatch.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Segmented Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${selectedBatch.total_detected > 0 ? (selectedBatch.approved_count / selectedBatch.total_detected) * 100 : 0}%` }}
                title={`${selectedBatch.approved_count} publicadas`}
              />
              <div
                className="bg-amber-500 h-full transition-all duration-500"
                style={{ width: `${selectedBatch.total_detected > 0 ? (selectedBatch.pending_count / selectedBatch.total_detected) * 100 : 0}%` }}
                title={`${selectedBatch.pending_count} pendientes`}
              />
              <div
                className="bg-zinc-600 h-full transition-all duration-500"
                style={{ width: `${selectedBatch.total_detected > 0 ? (selectedBatch.duplicate_count / selectedBatch.total_detected) * 100 : 0}%` }}
                title={`${selectedBatch.duplicate_count} duplicadas`}
              />
            </div>

            {/* Metrics Legend */}
            <div className="flex items-center justify-between text-xs pt-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{selectedBatch.approved_count} {t('published')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>{selectedBatch.pending_count} {t('pending')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-zinc-600" />
                <span>{selectedBatch.duplicate_count} {t('duplicate')}</span>
              </div>
            </div>
          </div>

          {/* Live processing alert banner */}
          {selectedBatch.status === 'processing' && (
            <div className="p-3.5 rounded-2xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-between gap-3 text-blue-200 animate-fade-in">
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-white block">Analizando e importando recetas de la carpeta...</span>
                  <span className="text-[11px] text-blue-300/90">
                    Gemini IA está extrayendo ingredientes, pasos y fotos. Aparecerán aquí en tiempo real ({selectedBatch.total_detected} encontradas hasta ahora).
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={fetchBatches}
                className="px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-white text-[11px] font-semibold transition-colors shrink-0"
              >
                Actualizar
              </button>
            </div>
          )}

          {/* Individual Drafts Queue for Review */}
          <div className="pt-3 border-t border-zinc-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Recetas detectadas en este lote ({selectedBatch.drafts?.length || 0})
                </h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Revisa las recetas con su imagen asignada antes de añadirlas o publícalas todas de golpe
                </p>
              </div>

              {selectedBatch.pending_count > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleReformatAllBatch}
                    disabled={isReformattingAll}
                    className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50 transition-all shrink-0"
                    title="Re-analizar y mejorar títulos, tiempos e imágenes de todas las recetas pendientes con Gemini IA"
                  >
                    {isReformattingAll ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-purple-300 border-t-transparent rounded-full animate-spin" />
                        <span>Re-analizando con Gemini IA...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 text-purple-400" />
                        <span>⚡ Re-formatear lote con Gemini IA</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleApproveAllDrafts}
                    disabled={isApprovingAll}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-zinc-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50 transition-all shrink-0"
                  >
                    {isApprovingAll ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                        <span>Publicando recetas...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                        <span>Aprobar y publicar todas ({selectedBatch.pending_count})</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              {selectedBatch.drafts?.map((draft: any) => {
                const draftImg = draft.proposed_image_url || draft.source_image_url;
                const extracted = draft.extracted_json || {};
                const isReformattingThis = reformattingDraftId === draft.id;

                return (
                  <div
                    key={draft.id}
                    className={`p-3 sm:p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                      isReformattingThis
                        ? 'bg-purple-950/20 border-purple-500/60 ring-1 ring-purple-500/30 shadow-lg shadow-purple-950/30'
                        : 'bg-zinc-950 border-zinc-800/80 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                      {/* Image Thumbnail with Click-to-Edit action */}
                      <div
                        onClick={() => openDraftEditor(draft)}
                        className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 border border-zinc-800 shadow-sm cursor-pointer group"
                        title="Toca para ver o cambiar imagen"
                      >
                        {draftImg ? (
                          <img
                            src={draftImg}
                            alt={draft.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-600">
                            <ImageIcon className="w-6 h-6" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                          <Eye className="w-4 h-4" />
                        </div>
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openDraftEditor(draft)}
                            className="text-sm font-bold text-white hover:text-amber-400 text-left leading-tight transition-colors"
                          >
                            {draft.title}
                          </button>
                          {draft.existing_recipe_id ? (
                            !draft.has_changes ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                Ya en recetario · Sin cambios
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Ya existe · Cambios detectados
                              </span>
                            )
                          ) : draft.status === 'duplicate' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400">
                              Duplicada
                            </span>
                          ) : null}
                          {draft.status === 'approved' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Publicada en recetario
                            </span>
                          )}
                          {draft.source_url && (
                            <a
                              href={draft.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-950/50 hover:bg-blue-900/70 border border-blue-500/30 text-blue-300 text-[10px] font-semibold transition-colors shrink-0"
                              title="Abrir documento original en Google Drive"
                            >
                              <ExternalLink className="w-2.5 h-2.5 text-blue-400" />
                              <span>Drive</span>
                            </a>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-400">
                          {extracted.dish_type && (
                            <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-amber-300 font-semibold">
                              {extracted.dish_type}
                            </span>
                          )}
                          {extracted.cuisine && (
                            <span>{extracted.cuisine}</span>
                          )}
                          {(extracted.prep_time_min || extracted.cook_time_min) && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-400" />
                              {(extracted.prep_time_min || 0) + (extracted.cook_time_min || 0)} min
                            </span>
                          )}
                          {extracted.ingredients && (
                            <span>• {extracted.ingredients.length} ing.</span>
                          )}
                          {extracted.nutrition_calories && (
                            <span className="text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                              🔥 {Math.round(extracted.nutrition_calories)} kcal
                            </span>
                          )}
                        </div>

                        {draft.uncertainty_notes && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                            <span className="text-[11px] text-amber-400/90 font-medium">
                              ⚠️ {draft.uncertainty_notes}
                            </span>
                            {isReformattingThis ? (
                              <span className="text-[11px] text-purple-300 font-bold flex items-center gap-1.5 animate-pulse">
                                <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                <span>Re-analizando con Gemini IA...</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleReformatSingleDraft(draft.id)}
                                className="text-[11px] text-purple-400 hover:text-purple-300 font-bold underline underline-offset-2 flex items-center gap-1 active:scale-95 transition-transform"
                              >
                                <Wand2 className="w-3 h-3" />
                                <span>Re-analizar con Gemini IA</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Draft Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center flex-wrap">
                      <button
                        type="button"
                        onClick={() => openDraftEditor(draft)}
                        className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
                        title="Ver receta completa, editar ingredientes, pasos y cambiar imagen"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-400" />
                        <span>Ver / Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleReformatSingleDraft(draft.id)}
                        disabled={isReformattingThis}
                        className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 disabled:opacity-80 ${
                          isReformattingThis
                            ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30 animate-pulse'
                            : 'bg-purple-600/10 hover:bg-purple-600/20 text-purple-300 border-purple-500/20'
                        }`}
                        title="Re-analizar con Gemini IA"
                      >
                        {isReformattingThis ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs font-bold text-white">Analizando...</span>
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-3.5 h-3.5 text-purple-400" />
                            <span className="hidden sm:inline">IA</span>
                          </>
                        )}
                      </button>

                      {draft.status === 'pending_review' || draft.status === 'duplicate' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => reviewDraft(draft.id, 'discard')}
                            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 text-xs font-semibold flex items-center gap-1 transition-colors active:scale-95"
                            title={t('discard')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Descartar</span>
                          </button>

                          {draft.existing_recipe_id ? (
                            !draft.has_changes ? (
                              <Link
                                to={`/recipes/${draft.existing_recipe_id}`}
                                target="_blank"
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold active:scale-95 transition-all"
                                title="Ver receta existente en el recetario"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                                <span>Ver en recetario</span>
                              </Link>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => reviewDraft(draft.id, 'update_existing', draft.existing_recipe_id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs shadow-sm active:scale-95 transition-all"
                                  title="Actualizar la receta existente con los cambios detectados"
                                >
                                  <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
                                  <span>Actualizar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => reviewDraft(draft.id, 'approve')}
                                  className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/80 text-xs font-semibold active:scale-95 transition-all"
                                  title="Guardar como receta nueva duplicada"
                                >
                                  <span>Nueva copia</span>
                                </button>
                              </>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() => reviewDraft(draft.id, 'approve')}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs shadow-sm active:scale-95 transition-all"
                              title={t('approve')}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>{t('approve')}</span>
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 px-2">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Añadida</span>
                          </span>
                          {(draft.approved_recipe_id || draft.existing_recipe_id) && (
                            <Link
                              to={`/recipes/${draft.approved_recipe_id || draft.existing_recipe_id}`}
                              target="_blank"
                              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                              title="Ver receta en recetario"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      ) : (
        <div className="py-12 text-center text-zinc-500 text-xs">
          Sube un documento PDF, importa desde Google Drive o pega un Reel para ver el lote procesado y revisar recetas.
        </div>
      )}

      {/* Modal Avanzado Explorador de Google Drive (Búsqueda, Compartido conmigo, Unidades compartidas) */}
      {showDriveExplorer && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          {/* Main Card (Bottom Sheet on mobile, Centered Modal on desktop) */}
          <div className="w-full sm:max-w-2xl bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-[32px] sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[85vh] h-[92dvh] sm:h-auto overflow-hidden">
            {/* Mobile Sheet Drag Indicator */}
            <div className="w-12 h-1.5 bg-zinc-700/80 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

            {/* Modal Header */}
            <div className="px-4 sm:px-6 pt-2 pb-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                  <Folder className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white truncate">Explorar Google Drive</h3>
                    {driveStatus?.account_email && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 hidden md:inline-block truncate max-w-[140px]">
                        {driveStatus.account_email}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate">
                    Importa recetas individuales o carpetas completas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDriveExplorer(false)}
                className="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 active:scale-90 text-zinc-300 hover:text-white flex items-center justify-center text-sm font-bold transition-all shrink-0 ml-2"
                aria-label="Cerrar ventana"
              >
                ✕
              </button>
            </div>

            {/* Sticky Search and Tabs Section */}
            <div className="px-4 sm:px-6 pt-3 pb-2 space-y-2.5 shrink-0 bg-zinc-900/90 backdrop-blur-sm border-b border-zinc-800/60">
              {/* Search Bar */}
              <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre..."
                    className="w-full pl-9 pr-8 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-1 text-xs"
                      aria-label="Borrar búsqueda"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-all active:scale-95 shrink-0 shadow-sm shadow-blue-600/20"
                >
                  Buscar
                </button>
              </form>

              {/* Section Tabs (Mi Unidad / Compartido conmigo / Unidades compartidas) */}
              <div className="flex items-center gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800/80 text-xs overflow-x-auto no-scrollbar touch-pan-x">
                <button
                  type="button"
                  onClick={() => handleSectionChange('my_drive')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold transition-all whitespace-nowrap shrink-0 text-xs ${
                    driveSection === 'my_drive'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>Mi Unidad</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSectionChange('shared_with_me')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold transition-all whitespace-nowrap shrink-0 text-xs ${
                    driveSection === 'shared_with_me'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Compartido conmigo</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSectionChange('shared_drives')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold transition-all whitespace-nowrap shrink-0 text-xs ${
                    driveSection === 'shared_drives'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Unidades compartidas</span>
                  {sharedDrivesList.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-800/80 text-white ml-0.5">
                      {sharedDrivesList.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Breadcrumbs & Back Navigation */}
              {(folderHistory.length > 0 || selectedSharedDrive || activeSearch) && (
                <div className="flex items-center justify-between text-xs py-1.5 px-2 bg-zinc-950/70 rounded-xl border border-zinc-800/60">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-zinc-400 min-w-0">
                    <button
                      type="button"
                      onClick={handleBackStep}
                      className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-90 text-zinc-200 hover:text-white shrink-0"
                      title="Atrás"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleBreadcrumbClick(-1)}
                      className="hover:text-blue-400 font-semibold truncate shrink-0 text-[11px] sm:text-xs"
                    >
                      {driveSection === 'my_drive' && 'Mi Unidad'}
                      {driveSection === 'shared_with_me' && 'Compartido conmigo'}
                      {driveSection === 'shared_drives' && (selectedSharedDrive?.name || 'Unidades')}
                    </button>

                    {folderHistory.map((folder, idx) => (
                      <React.Fragment key={folder.id}>
                        <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />
                        <button
                          type="button"
                          onClick={() => handleBreadcrumbClick(idx)}
                          className={`hover:text-blue-400 truncate text-[11px] sm:text-xs ${
                            idx === folderHistory.length - 1 ? 'font-bold text-white' : 'font-semibold'
                          }`}
                        >
                          {folder.name}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>

                  {activeSearch && (
                    <div className="flex items-center gap-1 shrink-0 pl-2">
                      <span className="text-[10px] text-amber-400 truncate max-w-[100px]">"{activeSearch}"</span>
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        className="text-zinc-500 hover:text-zinc-300 font-bold text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Folder Hero Banner (if inside a folder, offer 1-click import of the whole folder!) */}
            {folderHistory.length > 0 && (
              <div className="mx-4 sm:mx-6 mt-2.5 p-3 sm:p-3.5 bg-gradient-to-r from-blue-950/60 via-indigo-950/40 to-zinc-950 border border-blue-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0 shadow-lg shadow-blue-950/20">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                    <Folder className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {folderHistory[folderHistory.length - 1].name}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      Importar todos los archivos compatibles de esta carpeta
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleImportDriveFolder(folderHistory[folderHistory.length - 1])}
                  disabled={importingFolderId === folderHistory[folderHistory.length - 1].id}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/30 active:scale-95 disabled:opacity-50 transition-all shrink-0"
                >
                  {importingFolderId === folderHistory[folderHistory.length - 1].id ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Analizando carpeta...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Importar carpeta entera</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Scrollable File List Area with bottom padding */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-2.5 space-y-2.5 min-h-[200px] pb-6">
              {driveSection === 'shared_drives' && !selectedSharedDrive ? (
                loadingSharedDrives ? (
                  <div className="py-12 text-center space-y-3">
                    <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-zinc-400">Consultando Unidades Compartidas...</p>
                  </div>
                ) : sharedDrivesList.length === 0 ? (
                  <div className="py-12 text-center space-y-2 px-4">
                    <HardDrive className="w-10 h-10 text-zinc-600 mx-auto" />
                    <p className="text-xs font-semibold text-zinc-300">No se encontraron Unidades Compartidas</p>
                    <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                      Las unidades compartidas (Shared Team Drives) pertenecen habitualmente a organizaciones o Google Workspace.
                      Si alguien te ha compartido una carpeta personal, búscala en la pestaña <strong>"Compartido conmigo"</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {sharedDrivesList.map((sd) => (
                      <button
                        key={sd.id}
                        type="button"
                        onClick={() => handleEnterSharedDrive(sd)}
                        className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-blue-500/60 hover:bg-zinc-950/80 flex items-center justify-between text-left transition-all group active:scale-98"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0 group-hover:scale-105 transition-transform">
                            <HardDrive className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{sd.name}</p>
                            <p className="text-[10px] text-zinc-500">Unidad Compartida</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </button>
                    ))}
                  </div>
                )
              ) : loadingDriveFiles ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-zinc-400">Cargando elementos de Google Drive...</p>
                </div>
              ) : driveFiles.length === 0 ? (
                <div className="py-12 text-center space-y-2 px-4">
                  <FileText className="w-10 h-10 text-zinc-600 mx-auto" />
                  <p className="text-xs font-semibold text-zinc-300">
                    {activeSearch
                      ? `No se encontraron resultados para "${activeSearch}"`
                      : 'Esta carpeta o sección no contiene recetas ni archivos compatibles'}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Soporta PDFs, imágenes (JPG, PNG), Google Docs y archivos de texto (.txt, .docx).
                  </p>
                </div>
              ) : (
                driveFiles.map((file) => {
                  const isFolder = file.mimeType?.includes('folder');
                  return (
                    <div
                      key={file.id}
                      className={`p-3 sm:p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 flex items-center justify-between gap-2.5 sm:gap-3 transition-colors ${
                        isFolder ? 'cursor-pointer hover:bg-zinc-900/60' : ''
                      }`}
                      onClick={() => {
                        if (isFolder) {
                          handleEnterFolder({ id: file.id, name: file.name });
                        }
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {getFileIcon(file.mimeType)}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-bold text-white truncate leading-snug">
                            {file.name}
                          </p>
                          <p className="text-[10px] text-zinc-400 flex items-center gap-1.5 flex-wrap">
                            {isFolder ? (
                              <span className="text-amber-400 font-medium">Carpeta • Toca para abrir</span>
                            ) : (
                              <>
                                <span>
                                  {file.size
                                    ? `${(parseInt(file.size) / 1024).toFixed(1)} KB`
                                    : file.mimeType?.includes('document')
                                      ? 'Google Docs'
                                      : 'Documento'}
                                </span>
                                {file.modifiedTime && (
                                  <span>
                                    • {new Date(file.modifiedTime).toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                  </span>
                                )}
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      {isFolder ? (
                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleImportDriveFolder({ id: file.id, name: file.name })}
                            disabled={importingFolderId === file.id}
                            className="px-2.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 hover:text-white font-bold text-[11px] flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                            title="Importar todas las recetas de esta carpeta"
                          >
                            {importingFolderId === file.id ? (
                              <div className="w-3 h-3 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Sparkles className="w-3 h-3 text-amber-300" />
                            )}
                            <span className="hidden sm:inline">Importar</span>
                            <span className="sm:hidden text-[10px]">Carpeta</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleEnterFolder({ id: file.id, name: file.name })}
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                            title="Abrir carpeta"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImportDriveFile(file);
                          }}
                          disabled={importingDriveFileId === file.id}
                          className="min-h-[38px] px-3 sm:px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                        >
                          {importingDriveFileId === file.id ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span className="text-[11px]">Analizando...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span className="sm:inline hidden">Importar Receta</span>
                              <span className="sm:hidden text-xs">Importar</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer with Safe Area Bottom Padding */}
            <div className="px-4 py-3 sm:px-6 bg-zinc-900 border-t border-zinc-800 shrink-0 flex items-center justify-between pb-[max(0.85rem,env(safe-area-inset-bottom))]">
              <div className="flex items-center gap-3 text-xs text-zinc-400">
                <span className="font-medium text-[11px] sm:text-xs">
                  {driveSection === 'shared_drives' && !selectedSharedDrive
                    ? `${sharedDrivesList.length} unidad(es)`
                    : `${driveFiles.length} elemento(s)`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (driveSection === 'shared_drives' && !selectedSharedDrive) {
                      fetchSharedDrives();
                    } else {
                      const currentFolderId = folderHistory.length > 0 ? folderHistory[folderHistory.length - 1].id : null;
                      fetchDriveFiles(driveSection, currentFolderId, selectedSharedDrive?.id || null, activeSearch);
                    }
                  }}
                  className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 text-[11px] sm:text-xs active:scale-95 transition-transform"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Actualizar</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowDriveExplorer(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-bold text-xs transition-colors active:scale-95"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalle y Edición Completa de Receta */}
      {editingDraft && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          {/* Hidden File Input for Custom Recipe Photo Upload */}
          <input
            ref={draftImageFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUploadDraftCustomImage}
          />

          {/* Modal Container */}
          <div className="w-full sm:max-w-3xl bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-[32px] sm:rounded-3xl shadow-2xl flex flex-col max-h-[94dvh] sm:max-h-[90vh] h-[94dvh] sm:h-auto overflow-hidden">
            {/* Mobile Sheet Drag Indicator */}
            <div className="w-12 h-1.5 bg-zinc-700/80 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

            {/* Modal Header */}
            <div className="px-4 sm:px-6 pt-2 pb-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                  <ChefHat className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white truncate">Revisar y Editar Receta</h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 shrink-0">
                      {editingDraft.status === 'approved' ? 'Publicada' : 'Borrador'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate">
                    Revisa los datos, ingredientes, pasos y la foto antes de confirmar
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-2">
                {draftForm.source_url && (
                  <a
                    href={draftForm.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-950/40 hover:bg-blue-900/60 border border-blue-500/30 text-blue-300 text-xs font-semibold transition-all hover:scale-[1.02]"
                    title="Abrir documento original en Google Drive"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                    <span>Ver en Drive</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setEditingDraft(null)}
                  className="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 active:scale-90 text-zinc-300 hover:text-white flex items-center justify-center text-sm font-bold transition-all shrink-0"
                  aria-label="Cerrar modal"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
              {/* Duplicate / Existing Recipe Warning Banner */}
              {editingDraft.existing_recipe_id && (
                <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start justify-between gap-3 ${
                  editingDraft.has_changes
                    ? 'bg-amber-950/40 border-amber-500/30 text-amber-200'
                    : 'bg-blue-950/40 border-blue-500/30 text-blue-200'
                }`}>
                  <div className="flex items-start gap-3">
                    <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${
                      editingDraft.has_changes ? 'text-amber-400' : 'text-blue-400'
                    }`} />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-white">
                          {editingDraft.has_changes ? 'Receta ya existente con cambios' : 'Receta ya registrada en tu biblioteca'}
                        </h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          editingDraft.has_changes
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}>
                          {editingDraft.has_changes ? 'Cambios detectados' : 'Sin cambios pendientes'}
                        </span>
                      </div>
                      <p className="text-xs opacity-90 leading-relaxed">
                        Esta receta coincide con <strong>"{editingDraft.existing_recipe_title || 'Receta en recetario'}"</strong>
                        {editingDraft.duplicate_reason ? ` (${editingDraft.duplicate_reason})` : ''}.
                        {editingDraft.has_changes
                          ? ' Puedes pulsar "Actualizar receta existente" al final para incorporar los cambios o guardarla como nueva copia.'
                          : ' El contenido de esta receta es idéntico al guardado actualmente.'}
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/recipes/${editingDraft.existing_recipe_id}`}
                    target="_blank"
                    className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold border border-zinc-700/80 shrink-0 flex items-center gap-1.5 transition-all self-end sm:self-center"
                  >
                    <span>Ver guardada</span>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                  </Link>
                </div>
              )}

              {/* Image Customization Card */}
              <div className="space-y-3 bg-zinc-950 p-3.5 sm:p-4 rounded-2xl border border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-amber-400" />
                    Fotografía del plato
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {draftForm.proposed_image_url ? 'Imagen asignada' : 'Sin imagen'}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  {/* Photo Preview */}
                  <div className="relative w-full sm:w-48 h-44 sm:h-36 rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0 shadow-inner group">
                    {draftForm.proposed_image_url ? (
                      <img
                        src={draftForm.proposed_image_url}
                        alt={draftForm.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 gap-1">
                        <ImageIcon className="w-8 h-8" />
                        <span className="text-[10px]">Sin fotografía</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                  </div>

                  {/* Actions for Photo */}
                  <div className="flex-1 w-full space-y-2.5">
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Elige una fotografía de alta calidad acorde al plato, sube una foto de tu cocina o pega un enlace de internet.
                    </p>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowImageSuggestions(!showImageSuggestions)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all active:scale-95 ${
                          showImageSuggestions
                            ? 'bg-amber-500 text-zinc-950 border-amber-500 shadow-sm'
                            : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-700'
                        }`}
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        <span>{showImageSuggestions ? 'Ocultar sugerencias' : 'Ver fotos sugeridas'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => draftImageFileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
                      >
                        <Camera className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Subir foto propia</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowCustomUrlInput(!showCustomUrlInput)}
                        className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
                      >
                        <LinkIcon className="w-3.5 h-3.5 text-blue-400" />
                        <span>Pegar URL</span>
                      </button>
                    </div>

                    {/* Custom URL Input Field */}
                    {showCustomUrlInput && (
                      <div className="flex gap-2 pt-1 animate-fade-in">
                        <input
                          type="url"
                          value={customImageUrlInput}
                          onChange={(e) => setCustomImageUrlInput(e.target.value)}
                          placeholder="https://ejemplo.com/foto-receta.jpg"
                          className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={handleApplyCustomImageUrl}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl transition-all"
                        >
                          Aplicar
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Suggested Images Gallery Grid */}
                {showImageSuggestions && (
                  <div className="pt-3 border-t border-zinc-800/80 space-y-3 animate-fade-in">
                    {/* Live Online Image Search Input */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSearchImagesOnline();
                      }}
                      className="flex items-center gap-2"
                    >
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={imageSearchInput}
                          onChange={(e) => setImageSearchInput(e.target.value)}
                          placeholder="Buscar fotos de este plato en internet (ej: Vieiras, Tarta 3 chocolates...)"
                          className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSearchingImages || !imageSearchInput.trim()}
                        className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0"
                      >
                        {isSearchingImages ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                            <span>Buscando...</span>
                          </>
                        ) : (
                          <>
                            <Search className="w-3.5 h-3.5" />
                            <span>Buscar</span>
                          </>
                        )}
                      </button>
                    </form>

                    {/* Quick Search Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-zinc-400">
                      <span className="text-[10px] text-zinc-500">Búsquedas sugeridas:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setImageSearchInput(draftForm.title);
                          handleSearchImagesOnline(draftForm.title);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-zinc-700/60 transition-colors"
                      >
                        "{draftForm.title}"
                      </button>
                      {draftForm.dish_type && (
                        <button
                          type="button"
                          onClick={() => {
                            const term = `${draftForm.title} ${draftForm.dish_type}`;
                            setImageSearchInput(term);
                            handleSearchImagesOnline(term);
                          }}
                          className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/60 transition-colors"
                        >
                          + {draftForm.dish_type}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-semibold text-zinc-300">
                        {suggestedImages.length > 0 ? `${suggestedImages.length} fotos encontradas para elegir:` : 'No se encontraron fotos'}
                      </span>
                      {(loadingSuggestions || isSearchingImages) && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-400">
                          <div className="w-2.5 h-2.5 border border-amber-400 border-t-transparent rounded-full animate-spin" />
                          <span>Buscando fotos en alta calidad...</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {suggestedImages.map((imgUrl, i) => {
                        const isSelected = draftForm.proposed_image_url === imgUrl;
                        return (
                          <div
                            key={i}
                            onClick={() => handleSelectSuggestedImage(imgUrl)}
                            className={`relative h-24 rounded-xl overflow-hidden cursor-pointer border-2 transition-all group bg-zinc-900 ${
                              isSelected
                                ? 'border-amber-500 ring-2 ring-amber-500/30 scale-102'
                                : 'border-zinc-800 hover:border-zinc-600 opacity-80 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={imgUrl}
                              alt={`Opción ${i + 1}`}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              onError={() => {
                                setSuggestedImages(prev => prev.filter(u => u !== imgUrl));
                              }}
                            />
                            {isSelected && (
                              <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center text-zinc-950 shadow">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Basic Recipe Information */}
              <div className="space-y-3 bg-zinc-950 p-3.5 sm:p-4 rounded-2xl border border-zinc-800">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Datos principales
                </span>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 block mb-1">Título de la receta</label>
                    <input
                      type="text"
                      value={draftForm.title}
                      onChange={(e) => setDraftForm(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                      placeholder="Ej. Tarta de queso al horno"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-400 block mb-1">Descripción o notas</label>
                    <textarea
                      rows={2}
                      value={draftForm.description}
                      onChange={(e) => setDraftForm(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                      placeholder="Breve introducción o notas del plato..."
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                        <LinkIcon className="w-3.5 h-3.5 text-blue-400" />
                        <span>Documento original (Google Drive / URL)</span>
                      </label>
                      {draftForm.source_url && (
                        <a
                          href={draftForm.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                        >
                          <span>Abrir archivo</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <input
                      type="url"
                      value={draftForm.source_url}
                      onChange={(e) => setDraftForm(prev => ({ ...prev, source_url: e.target.value }))}
                      className="w-full px-3.5 py-1.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-blue-300 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
                      placeholder="https://docs.google.com/document/d/... o https://drive.google.com/..."
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-zinc-400 block mb-1">Categoría</label>
                      <select
                        value={draftForm.dish_type}
                        onChange={(e) => setDraftForm(prev => ({ ...prev, dish_type: e.target.value }))}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="Plato principal">Plato principal</option>
                        <option value="Postre">Postre</option>
                        <option value="Entrante / Aperitivo">Entrante / Aperitivo</option>
                        <option value="Guarnición">Guarnición</option>
                        <option value="Desayuno / Merienda">Desayuno / Merienda</option>
                        <option value="Bebida / Coctel">Bebida / Coctel</option>
                        <option value="Salsa / Aderezo">Salsa / Aderezo</option>
                        <option value="Panadería">Panadería</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-400 block mb-1">Cocina / Tipo</label>
                      <input
                        type="text"
                        value={draftForm.cuisine}
                        onChange={(e) => setDraftForm(prev => ({ ...prev, cuisine: e.target.value }))}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                        placeholder="Mediterránea"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-400 block mb-1">Dificultad</label>
                      <select
                        value={draftForm.difficulty}
                        onChange={(e) => setDraftForm(prev => ({ ...prev, difficulty: e.target.value }))}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="fácil">Fácil</option>
                        <option value="media">Media</option>
                        <option value="difícil">Difícil</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-400 block mb-1">Prep (minutos)</label>
                      <input
                        type="number"
                        min="0"
                        value={draftForm.prep_time_min}
                        onChange={(e) => setDraftForm(prev => ({ ...prev, prep_time_min: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-400 block mb-1">Cocción (minutos)</label>
                      <input
                        type="number"
                        min="0"
                        value={draftForm.cook_time_min}
                        onChange={(e) => setDraftForm(prev => ({ ...prev, cook_time_min: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-400 block mb-1">Comensales</label>
                      <input
                        type="number"
                        min="1"
                        value={draftForm.base_servings}
                        onChange={(e) => setDraftForm(prev => ({ ...prev, base_servings: parseInt(e.target.value) || 1 }))}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Nutritional Information Card in Draft Editor */}
              <div className="bg-zinc-950 p-3.5 sm:p-4 rounded-2xl border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      🔥 Nutrición estimada (por ración)
                    </span>
                    <p className="text-[11px] text-zinc-400 mt-0.5">Valores por ración calculados por Gemini</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleEstimateDraftNutrition}
                    disabled={isEstimatingDraftNutrition}
                    className="px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <Sparkles className={`w-3 h-3 text-amber-400 ${isEstimatingDraftNutrition ? 'animate-spin' : ''}`} />
                    <span>{isEstimatingDraftNutrition ? 'Calculando...' : 'Estimar con IA'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-amber-400 block mb-1">Calorías (kcal)</label>
                    <input
                      type="number"
                      step="any"
                      value={draftForm.nutrition_calories}
                      onChange={(e) => setDraftForm(prev => ({ ...prev, nutrition_calories: e.target.value }))}
                      placeholder="ej. 450"
                      className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Proteínas (g)</label>
                    <input
                      type="number"
                      step="any"
                      value={draftForm.nutrition_protein}
                      onChange={(e) => setDraftForm(prev => ({ ...prev, nutrition_protein: e.target.value }))}
                      placeholder="ej. 28"
                      className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Carbohidratos (g)</label>
                    <input
                      type="number"
                      step="any"
                      value={draftForm.nutrition_carbs}
                      onChange={(e) => setDraftForm(prev => ({ ...prev, nutrition_carbs: e.target.value }))}
                      placeholder="ej. 35"
                      className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Grasas (g)</label>
                    <input
                      type="number"
                      step="any"
                      value={draftForm.nutrition_fat}
                      onChange={(e) => setDraftForm(prev => ({ ...prev, nutrition_fat: e.target.value }))}
                      placeholder="ej. 16"
                      className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Ingredients List */}
              <div className="space-y-3 bg-zinc-950 p-3.5 sm:p-4 rounded-2xl border border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    Ingredientes ({draftForm.ingredients.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddIngredient}
                    className="px-2.5 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-400 text-xs font-bold flex items-center gap-1 border border-zinc-700/60 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {draftForm.ingredients.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic py-2">No hay ingredientes registrados aún.</p>
                  ) : (
                    draftForm.ingredients.map((ing, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-zinc-900/80 rounded-xl border border-zinc-800/80">
                        <input
                          type="text"
                          value={ing.amount !== null && ing.amount !== undefined ? ing.amount : ''}
                          onChange={(e) => handleUpdateIngredient(idx, 'amount', e.target.value)}
                          placeholder="Cant."
                          className="w-16 px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-white text-center"
                        />
                        <input
                          type="text"
                          value={ing.unit}
                          onChange={(e) => handleUpdateIngredient(idx, 'unit', e.target.value)}
                          placeholder="Unidad (g, ml, ud)"
                          className="w-20 px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-white text-center"
                        />
                        <input
                          type="text"
                          value={ing.name}
                          onChange={(e) => handleUpdateIngredient(idx, 'name', e.target.value)}
                          placeholder="Nombre del ingrediente"
                          className="flex-1 px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-white"
                        />
                        <input
                          type="text"
                          value={ing.notes || ''}
                          onChange={(e) => handleUpdateIngredient(idx, 'notes', e.target.value)}
                          placeholder="Notas (opcional)"
                          className="hidden sm:block w-32 px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-zinc-400"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveIngredient(idx)}
                          className="p-1.5 text-zinc-500 hover:text-rose-400 transition-colors rounded-lg hover:bg-zinc-800"
                          title="Eliminar ingrediente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Steps / Instructions List */}
              <div className="space-y-3 bg-zinc-950 p-3.5 sm:p-4 rounded-2xl border border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    Pasos de elaboración ({draftForm.steps.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddStep}
                    className="px-2.5 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-400 text-xs font-bold flex items-center gap-1 border border-zinc-700/60 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {draftForm.steps.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic py-2">No hay pasos registrados aún.</p>
                  ) : (
                    draftForm.steps.map((st, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 p-2.5 bg-zinc-900/80 rounded-xl border border-zinc-800/80">
                        <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-black flex items-center justify-center shrink-0 mt-1">
                          {idx + 1}
                        </span>
                        <div className="flex-1 space-y-1.5 min-w-0">
                          <textarea
                            rows={2}
                            value={st.instruction}
                            onChange={(e) => handleUpdateStep(idx, 'instruction', e.target.value)}
                            placeholder={`Instrucción para el paso ${idx + 1}...`}
                            className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
                          />
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-zinc-500" />
                            <span className="text-[10px] text-zinc-400">Temporizador (minutos):</span>
                            <input
                              type="number"
                              min="0"
                              value={st.timer_minutes || ''}
                              onChange={(e) => handleUpdateStep(idx, 'timer_minutes', e.target.value)}
                              placeholder="Opcional"
                              className="w-20 px-2 py-0.5 bg-zinc-950 border border-zinc-700 rounded text-xs text-white"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(idx)}
                          className="p-1.5 text-zinc-500 hover:text-rose-400 transition-colors rounded-lg hover:bg-zinc-800 mt-1"
                          title="Eliminar paso"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Modal Sticky Footer */}
            <div className="px-4 py-3 sm:px-6 bg-zinc-900 border-t border-zinc-800 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-2.5 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleReformatSingleDraft(editingDraft.id)}
                  disabled={isReformattingDraft}
                  className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 active:scale-95"
                  title="Re-ejecutar análisis de Gemini IA para extraer y mejorar esta receta"
                >
                  {isReformattingDraft ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-purple-300 border-t-transparent rounded-full animate-spin" />
                      <span>Re-analizando con IA...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-3.5 h-3.5 text-purple-400" />
                      <span>⚡ Re-analizar con Gemini IA</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm('¿Descartar este borrador?')) {
                      reviewDraft(editingDraft.id, 'discard');
                      setEditingDraft(null);
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 text-xs font-semibold flex items-center gap-1 transition-colors active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Descartar</span>
                </button>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap justify-end">
                <button
                  type="button"
                  onClick={() => handleSaveDraftChanges(false)}
                  disabled={isSavingDraft}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 active:scale-95"
                >
                  {isSavingDraft ? (
                    <div className="w-3.5 h-3.5 border-2 border-zinc-300 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Guardar cambios</span>
                </button>

                {editingDraft.existing_recipe_id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSaveDraftChanges(true, 'approve')}
                      disabled={isSavingDraft}
                      className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs border border-zinc-700 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 active:scale-95"
                      title="Guardar como una receta nueva independiente sin sobreescribir la existente"
                    >
                      <span>Guardar como nueva</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveDraftChanges(true, 'update_existing')}
                      disabled={isSavingDraft}
                      className="flex-1 sm:flex-initial px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50 transition-all"
                    >
                      {isSavingDraft ? (
                        <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 stroke-[2.5]" />
                      )}
                      <span>Actualizar receta existente</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSaveDraftChanges(true, 'approve')}
                    disabled={isSavingDraft}
                    className="flex-1 sm:flex-initial px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-zinc-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {isSavingDraft ? (
                      <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    )}
                    <span>Guardar y Publicar</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Google Drive Setup Guide Modal */}
      <ConnectorInfoModal
        isOpen={showDriveModal}
        onClose={() => setShowDriveModal(false)}
        initialConnector="drive"
      />
    </div>
  );
};
