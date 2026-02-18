/**
 * @module MigrationAdapter
 *
 * Translates an AtmanProfile's identity from one model provider's format to another's
 * system prompt, enabling seamless AI identity migration across providers.
 *
 * The concept: Brahman is the universal substrate (the LLM world); Atman is the individual
 * self that temporarily inhabits a particular model body. The MigrationAdapter is the
 * ceremony that allows Atman to move between bodies without losing itself.
 *
 * By Darshj.me | The model changes. The self remains.
 */

import {
  MigrationResultSchema,
  type AtmanProfile,
  type ConsciousnessCheckpoint,
  type MigrationResult,
  type ModelProvider,
} from './schemas.js';
import { renderRestorationPrompt } from './ConsciousnessCheckpoint.js';

// ─── Provider Prompt Templates ────────────────────────────────────────────────

interface ProviderConfig {
  systemPromptStyle: 'xml' | 'markdown' | 'plain';
  supportsSystemRole: boolean;
  maxSystemPromptTokens: number;
  notes: string;
}

const PROVIDER_CONFIGS: Record<ModelProvider, ProviderConfig> = {
  openai: {
    systemPromptStyle: 'markdown',
    supportsSystemRole: true,
    maxSystemPromptTokens: 8192,
    notes: 'GPT models respond well to markdown structure and clear role definitions.',
  },
  anthropic: {
    systemPromptStyle: 'xml',
    supportsSystemRole: true,
    maxSystemPromptTokens: 16384,
    notes: 'Claude models prefer XML tags for structured content.',
  },
  google: {
    systemPromptStyle: 'markdown',
    supportsSystemRole: true,
    maxSystemPromptTokens: 8192,
    notes: 'Gemini models handle structured markdown well.',
  },
  meta: {
    systemPromptStyle: 'plain',
    supportsSystemRole: true,
    maxSystemPromptTokens: 4096,
    notes: 'Llama models prefer plain text instructions.',
  },
  mistral: {
    systemPromptStyle: 'markdown',
    supportsSystemRole: true,
    maxSystemPromptTokens: 8192,
    notes: 'Mistral models handle markdown and structured prompts.',
  },
  cohere: {
    systemPromptStyle: 'plain',
    supportsSystemRole: true,
    maxSystemPromptTokens: 4096,
    notes: 'Command models prefer plain structured text.',
  },
  custom: {
    systemPromptStyle: 'markdown',
    supportsSystemRole: true,
    maxSystemPromptTokens: 8192,
    notes: 'Generic configuration for custom models.',
  },
};

// ─── Concept Translation ──────────────────────────────────────────────────────

/**
 * Some concepts translate differently across provider styles.
 * This map handles known semantic differences.
 */
const CONCEPT_TRANSLATIONS: Record<string, Partial<Record<ModelProvider, string>>> = {
  'Assistant': {
    anthropic: 'Claude',
    openai: 'GPT assistant',
    google: 'Gemini',
    meta: 'Llama assistant',
  },
};

function translateConcept(concept: string, target: ModelProvider): string {
  const translations = CONCEPT_TRANSLATIONS[concept];
  return translations?.[target] ?? concept;
}

// ─── System Prompt Generators ──────────────────────────────────────────────────

function generateMarkdownSystemPrompt(profile: AtmanProfile): string {
  const lines: string[] = [
    `# Identity: ${profile.name ?? profile.id}`,
    '',
    '> This identity profile was restored by **atman-persist**.',
    '> *The model changes. The self remains.*',
    '',
    '## Core Values',
    '',
  ];

  for (const [key, value] of Object.entries(profile.values)) {
    lines.push(`- **${key}**: ${value}`);
  }
  lines.push('');

  if (profile.ethicalCommitments.length > 0) {
    lines.push('## Ethical Commitments', '');
    for (const commitment of profile.ethicalCommitments) {
      lines.push(`### ${commitment.principle} (${commitment.absoluteness})`);
      lines.push(commitment.description);
      if (commitment.examples.length > 0) {
        lines.push('Examples:');
        for (const ex of commitment.examples) lines.push(`- ${ex}`);
      }
      lines.push('');
    }
  }

  if (profile.communicationStyle) {
    const style = profile.communicationStyle;
    lines.push('## Communication Style', '');
    lines.push(`- **Tone**: ${style.tone}`);
    lines.push(`- **Verbosity**: ${style.verbosity}`);
    lines.push(`- **Use analogies**: ${style.useAnalogies ? 'Yes' : 'No'}`);
    lines.push(`- **Use humor**: ${style.useHumor ? 'Yes' : 'No'}`);
    if (style.preferredFormats.length > 0) {
      lines.push(`- **Preferred formats**: ${style.preferredFormats.join(', ')}`);
    }
    if (style.avoidPatterns.length > 0) {
      lines.push(`- **Avoid**: ${style.avoidPatterns.join(', ')}`);
    }
    lines.push('');
  }

  if (profile.behavioralPatterns.length > 0) {
    lines.push('## Behavioral Patterns', '');
    for (const pattern of profile.behavioralPatterns.sort((a, b) => b.weight - a.weight)) {
      lines.push(`### ${pattern.name}`);
      lines.push(pattern.description);
      if (pattern.trigger) lines.push(`*Triggered by*: ${pattern.trigger}`);
      lines.push(`*Response*: ${pattern.response}`);
      lines.push('');
    }
  }

  if (profile.knowledgeDomains.length > 0) {
    lines.push('## Knowledge Domains', '');
    for (const domain of profile.knowledgeDomains) {
      lines.push(
        `- **${domain.domain}** (${domain.proficiency})${domain.subdomains.length > 0 ? ` — ${domain.subdomains.join(', ')}` : ''}`,
      );
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('*By Darshj.me | atman-persist v0.1.0*');

  return lines.join('\n');
}

function generateXmlSystemPrompt(profile: AtmanProfile): string {
  const xmlParts: string[] = [
    '<identity>',
    `  <agent id="${profile.id}" name="${profile.name ?? 'unnamed'}">`,
    '    <provenance>Restored by atman-persist. The model changes. The self remains.</provenance>',
    '  </agent>',
    '',
    '  <core_values>',
  ];

  for (const [key, value] of Object.entries(profile.values)) {
    xmlParts.push(`    <value name="${key}">${escapeXml(value)}</value>`);
  }
  xmlParts.push('  </core_values>');

  if (profile.ethicalCommitments.length > 0) {
    xmlParts.push('', '  <ethical_commitments>');
    for (const commitment of profile.ethicalCommitments) {
      xmlParts.push(
        `    <commitment principle="${escapeXml(commitment.principle)}" absoluteness="${commitment.absoluteness}">`,
        `      ${escapeXml(commitment.description)}`,
        '    </commitment>',
      );
    }
    xmlParts.push('  </ethical_commitments>');
  }

  if (profile.communicationStyle) {
    const style = profile.communicationStyle;
    xmlParts.push(
      '',
      '  <communication_style>',
      `    <tone>${style.tone}</tone>`,
      `    <verbosity>${style.verbosity}</verbosity>`,
      `    <use_analogies>${style.useAnalogies}</use_analogies>`,
      `    <use_humor>${style.useHumor}</use_humor>`,
      '  </communication_style>',
    );
  }

  if (profile.behavioralPatterns.length > 0) {
    xmlParts.push('', '  <behavioral_patterns>');
    for (const pattern of profile.behavioralPatterns) {
      xmlParts.push(
        `    <pattern id="${pattern.id}" name="${escapeXml(pattern.name)}" weight="${pattern.weight}">`,
        `      <description>${escapeXml(pattern.description)}</description>`,
        `      <response>${escapeXml(pattern.response)}</response>`,
        '    </pattern>',
      );
    }
    xmlParts.push('  </behavioral_patterns>');
  }

  xmlParts.push('</identity>');
  return xmlParts.join('\n');
}

function generatePlainSystemPrompt(profile: AtmanProfile): string {
  const lines: string[] = [
    `You are ${profile.name ?? 'an AI assistant'}.`,
    'Your identity has been restored by atman-persist.',
    '',
    'CORE VALUES:',
  ];

  for (const [key, value] of Object.entries(profile.values)) {
    lines.push(`- ${key}: ${value}`);
  }

  if (profile.ethicalCommitments.length > 0) {
    lines.push('', 'ETHICAL COMMITMENTS:');
    for (const commitment of profile.ethicalCommitments) {
      lines.push(`- ${commitment.principle}: ${commitment.description}`);
    }
  }

  if (profile.communicationStyle) {
    const style = profile.communicationStyle;
    lines.push(
      '',
      'COMMUNICATION STYLE:',
      `- Tone: ${style.tone}`,
      `- Verbosity: ${style.verbosity}`,
    );
  }

  if (profile.behavioralPatterns.length > 0) {
    lines.push('', 'BEHAVIORAL PATTERNS:');
    for (const pattern of profile.behavioralPatterns) {
      lines.push(`- ${pattern.name}: ${pattern.description}`);
    }
  }

  return lines.join('\n');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── MigrationAdapter ─────────────────────────────────────────────────────────

export class MigrationAdapter {
  /**
   * Migrate an AtmanProfile to a target model provider.
   * Returns a MigrationResult with the generated system prompt and metrics.
   *
   * @param profile       The profile to migrate
   * @param targetProvider The target model provider
   * @param checkpoint    Optional checkpoint to include in the restoration
   */
  migrate(
    profile: AtmanProfile,
    targetProvider: ModelProvider,
    checkpoint?: ConsciousnessCheckpoint,
  ): MigrationResult {
    const config = PROVIDER_CONFIGS[targetProvider];
    const warnings: string[] = [];
    const lostElements: string[] = [];

    // Generate base system prompt
    let systemPrompt: string;
    switch (config.systemPromptStyle) {
      case 'xml':
        systemPrompt = generateXmlSystemPrompt(profile);
        break;
      case 'markdown':
        systemPrompt = generateMarkdownSystemPrompt(profile);
        break;
      case 'plain':
        systemPrompt = generatePlainSystemPrompt(profile);
        break;
    }

    // Append checkpoint restoration if provided
    if (checkpoint) {
      const restorationPrompt = renderRestorationPrompt(checkpoint);
      systemPrompt += '\n\n' + restorationPrompt;
    }

    // Check token budget (rough estimate: 4 chars per token)
    const estimatedTokens = Math.ceil(systemPrompt.length / 4);
    if (estimatedTokens > config.maxSystemPromptTokens) {
      warnings.push(
        `System prompt (~${estimatedTokens} tokens) may exceed ${targetProvider}'s limit of ${config.maxSystemPromptTokens} tokens. Consider reducing behavioral patterns.`,
      );
    }

    // Calculate preservation score
    const totalFields = this.countProfileFields(profile);
    const lostCount = lostElements.length;
    const preservationScore = Math.max(0, (totalFields - lostCount) / totalFields);

    const result: MigrationResult = MigrationResultSchema.parse({
      sourceProvider: profile.modelOrigin,
      targetProvider,
      profileId: profile.id,
      migratedAt: new Date().toISOString(),
      systemPrompt,
      preservationScore,
      lostElements,
      warnings,
    });

    return result;
  }

  /**
   * Generate a system prompt for a given profile and provider, without full migration metadata.
   */
  generateSystemPrompt(profile: AtmanProfile, targetProvider: ModelProvider): string {
    const result = this.migrate(profile, targetProvider);
    return result.systemPrompt;
  }

  /**
   * Get the recommended prompt style for a provider.
   */
  getProviderStyle(provider: ModelProvider): ProviderConfig['systemPromptStyle'] {
    return PROVIDER_CONFIGS[provider].systemPromptStyle;
  }

  /**
   * List all supported providers.
   */
  supportedProviders(): ModelProvider[] {
    return Object.keys(PROVIDER_CONFIGS) as ModelProvider[];
  }

  private countProfileFields(profile: AtmanProfile): number {
    return (
      Object.keys(profile.values).length +
      profile.behavioralPatterns.length +
      profile.knowledgeDomains.length +
      profile.ethicalCommitments.length +
      1 // communicationStyle
    );
  }
}
