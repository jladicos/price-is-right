import { toaster } from '../components/ui/toaster';

export { toaster };

export const showToast = (options: {
  title: string;
  description?: string;
  type: 'success' | 'error' | 'info' | 'warning';
}) => {
  toaster.create({
    title: options.title,
    description: options.description,
    type: options.type,
  });
};
