/**
 * Tests para utilidades de balanceService (validateFile, formatFileSize)
 *
 * Cubre:
 *  - validateFile: extensiones permitidas y rechazadas
 *  - validateFile: límite de tamaño (10 MB)
 *  - formatFileSize: bytes, KB, MB
 *  - ALLOWED_FILE_EXTENSIONS: lista completa
 *
 * Ejecutar:
 *   cd frontend && npx vitest run src/__tests__/balanceServiceUtils.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  validateFile,
  formatFileSize,
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILE_SIZE,
} from '../services/balanceService';

describe('validateFile', () => {
  const makeFile = (name: string, size: number = 1024) =>
    new File(['x'.repeat(size)], name, { type: 'application/octet-stream' });

  describe('extensiones permitidas', () => {
    const allowedNames = [
      'doc.pdf', 'photo.jpg', 'photo.jpeg', 'image.png',
      'data.xls', 'data.xlsx', 'report.doc', 'report.docx',
      'data.csv', 'banner.webp',
    ];

    allowedNames.forEach(name => {
      it(`acepta ${name}`, () => {
        const result = validateFile(makeFile(name));
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });
  });

  describe('extensiones rechazadas', () => {
    const rejectedNames = ['virus.exe', 'script.js', 'page.html', 'data.json', 'archive.zip', 'app.sh'];

    rejectedNames.forEach(name => {
      it(`rechaza ${name}`, () => {
        const result = validateFile(makeFile(name));
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Tipo no permitido');
      });
    });
  });

  describe('límite de tamaño', () => {
    it('acepta archivo justo en el límite (10 MB)', () => {
      const file = makeFile('ok.pdf', MAX_FILE_SIZE);
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    it('rechaza archivo mayor a 10 MB', () => {
      const file = makeFile('big.pdf', MAX_FILE_SIZE + 1);
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('demasiado grande');
    });

    it('acepta archivo pequeño (1 KB)', () => {
      const file = makeFile('small.png', 1024);
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });
  });
});

describe('formatFileSize', () => {
  it('formatea bytes < 1024 como B', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('formatea bytes como KB', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('formatea bytes como MB', () => {
    expect(formatFileSize(5242880)).toBe('5.0 MB');
  });

  it('formatea 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('formatea 1024 bytes como 1.0 KB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
  });

  it('formatea 1048576 bytes como 1.0 MB', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB');
  });
});

describe('ALLOWED_FILE_EXTENSIONS', () => {
  it('contiene 10 extensiones', () => {
    expect(ALLOWED_FILE_EXTENSIONS).toHaveLength(10);
  });

  it('incluye pdf', () => {
    expect(ALLOWED_FILE_EXTENSIONS).toContain('pdf');
  });

  it('incluye jpg y jpeg', () => {
    expect(ALLOWED_FILE_EXTENSIONS).toContain('jpg');
    expect(ALLOWED_FILE_EXTENSIONS).toContain('jpeg');
  });

  it('incluye png', () => {
    expect(ALLOWED_FILE_EXTENSIONS).toContain('png');
  });

  it('incluye xlsx y xls', () => {
    expect(ALLOWED_FILE_EXTENSIONS).toContain('xlsx');
    expect(ALLOWED_FILE_EXTENSIONS).toContain('xls');
  });

  it('incluye doc y docx', () => {
    expect(ALLOWED_FILE_EXTENSIONS).toContain('doc');
    expect(ALLOWED_FILE_EXTENSIONS).toContain('docx');
  });

  it('incluye csv', () => {
    expect(ALLOWED_FILE_EXTENSIONS).toContain('csv');
  });

  it('incluye webp', () => {
    expect(ALLOWED_FILE_EXTENSIONS).toContain('webp');
  });

  it('no incluye exe', () => {
    expect(ALLOWED_FILE_EXTENSIONS).not.toContain('exe');
  });
});
