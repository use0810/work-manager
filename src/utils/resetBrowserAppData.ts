import { clearWorkRecordsAndArchivesStorage } from '../utils/storage';
import { clearAcceptedGuideAndTerms } from '../utils/onboardingStorage';

/**
 * 本アプリが localStorage に保存するデータをすべて消去する。
 */
export function resetAllBrowserStoredAppData(): void {
  clearWorkRecordsAndArchivesStorage();
  clearAcceptedGuideAndTerms();
}
