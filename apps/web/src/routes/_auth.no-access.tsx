import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/no-access')({
  component: NoAccessPage,
});

function NoAccessPage() {
  return (
    <div className="mx-auto max-w-md py-10">
      <Card>
        <CardHeader>
          <CardTitle>Нет доступа</CardTitle>
          <CardDescription>У вашей роли нет прав для просмотра этого раздела.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/" className="text-sm font-medium text-[var(--color-accent)] hover:underline">
            Вернуться на главную
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
