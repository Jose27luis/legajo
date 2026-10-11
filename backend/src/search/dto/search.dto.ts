import { ApiProperty } from '@nestjs/swagger';
import { DocumentDto } from '../../documents/dto/document.dto';
import { ESTADOS, WorkerListItemDto, type EstadoValor } from '../../workers/dto/worker.dto';
import { CLASES, type ClaseBusqueda } from '../search-text';

export class QuickWorkerDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  numeroDoc: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty({ type: String, nullable: true })
  cargo: string | null;

  @ApiProperty({ type: String, nullable: true })
  area: string | null;

  @ApiProperty({ enum: ESTADOS })
  estado: EstadoValor;
}

export class QuickDocumentDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  trabajadorId: string;

  @ApiProperty()
  trabajador: string;

  @ApiProperty()
  seccion: number;

  @ApiProperty()
  tipo: string;

  @ApiProperty({ type: String, nullable: true })
  numero: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  fechaEmision: string | null;
}

export class QuickResultDto {
  @ApiProperty({ type: [QuickWorkerDto] })
  trabajadores: QuickWorkerDto[];

  @ApiProperty({ type: [QuickDocumentDto] })
  documentos: QuickDocumentDto[];
}

export class SearchWorkerDto {
  @ApiProperty({ type: WorkerListItemDto })
  trabajador: WorkerListItemDto;

  @ApiProperty({ description: 'Documentos disponibles que la cuenta puede ver' })
  documentos: number;
}

export class SearchDocumentDto {
  @ApiProperty({ type: DocumentDto })
  documento: DocumentDto;

  @ApiProperty({ format: 'uuid' })
  trabajadorId: string;

  @ApiProperty()
  trabajador: string;

  @ApiProperty()
  numeroDoc: string;
}

export class SearchWorkersPageDto {
  @ApiProperty({ type: [SearchWorkerDto] })
  items: SearchWorkerDto[];

  @ApiProperty()
  total: number;
}

export class SearchDocumentsPageDto {
  @ApiProperty({ type: [SearchDocumentDto] })
  items: SearchDocumentDto[];

  @ApiProperty()
  total: number;
}

export class SearchResultDto {
  @ApiProperty({ enum: CLASES, nullable: true, description: 'Cómo se interpretó el texto' })
  clase: ClaseBusqueda | null;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  porPagina: number;

  @ApiProperty({ type: SearchWorkersPageDto })
  trabajadores: SearchWorkersPageDto;

  @ApiProperty({ type: SearchDocumentsPageDto })
  documentos: SearchDocumentsPageDto;
}
