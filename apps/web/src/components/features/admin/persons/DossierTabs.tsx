import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DossierContractsTab } from './DossierContractsTab';
import { DossierFilmsTab } from './DossierFilmsTab';
import { DossierOscarsTab } from './DossierOscarsTab';
import { DossierRatingTab } from './DossierRatingTab';

type Props = { personId: string };

export const DossierTabs = ({ personId }: Props) => (
  <Tabs defaultValue="rating">
    <TabsList>
      <TabsTrigger value="rating">Рейтинг</TabsTrigger>
      <TabsTrigger value="contracts">Контракты</TabsTrigger>
      <TabsTrigger value="films">Фильмы</TabsTrigger>
      <TabsTrigger value="oscars">Оскары</TabsTrigger>
    </TabsList>
    <TabsContent value="rating">
      <DossierRatingTab personId={personId} />
    </TabsContent>
    <TabsContent value="contracts">
      <DossierContractsTab personId={personId} />
    </TabsContent>
    <TabsContent value="films">
      <DossierFilmsTab personId={personId} />
    </TabsContent>
    <TabsContent value="oscars">
      <DossierOscarsTab personId={personId} />
    </TabsContent>
  </Tabs>
);
