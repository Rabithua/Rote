import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/utils/cn';
import { getConfigStatus, setupSystem, testConfig } from '@/utils/setupApi';
import { CheckCircle, Circle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// 向导步骤类型定义
interface WizardStep {
  id: string;
  title: string;
  description: string;
}

// 配置表单数据类型
interface SetupConfig {
  // 基础配置
  siteName: string;
  siteDescription: string;
  siteUrl: string;

  // R2 存储配置
  r2Config: {
    accountId: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    region: string;
    urlPrefix: string;
  };

  // 管理员账户
  admin: {
    username: string;
    email: string;
    password: string;
    nickname: string;
  };
}

const wizardSteps: WizardStep[] = [
  {
    id: 'basic',
    title: 'pages.setupWizard.steps.basic.title',
    description: 'pages.setupWizard.steps.basic.description',
  },
  {
    id: 'storage',
    title: 'pages.setupWizard.steps.storage.title',
    description: 'pages.setupWizard.steps.storage.description',
  },
  {
    id: 'admin',
    title: 'pages.setupWizard.steps.admin.title',
    description: 'pages.setupWizard.steps.admin.description',
  },
];

export default function SetupWizard() {
  const navigate = useNavigate();
  const { t } = useTranslation('translation');
  const [currentStep, setCurrentStep] = useState(0);
  const [config, setConfig] = useState<SetupConfig>({
    siteName: '',
    siteDescription: '',
    siteUrl: '',
    r2Config: {
      accountId: '',
      accessKey: '',
      secretKey: '',
      bucket: '',
      region: 'auto',
      urlPrefix: '',
    },
    admin: {
      username: 'admin',
      email: '',
      password: '',
      nickname: 'Administrator',
    },
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [_isSystemInitialized, setIsSystemInitialized] = useState(false);

  // 检查系统初始化状态
  useEffect(() => {
    const checkSystemStatus = async () => {
      try {
        const response = await getConfigStatus();
        if (response.data?.isInitialized) {
          setIsSystemInitialized(true);
          toast.info(t('pages.setupWizard.toasts.systemInitialized'));
          // 可以在这里跳转到设置页面
        }
      } catch (_error) {
        // 系统未初始化，继续显示向导
      }
    };

    checkSystemStatus();
  }, []);

  // 验证当前步骤
  const validateStep = (stepIndex: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (stepIndex) {
      case 0: // 基础配置
        if (!config.siteName.trim()) {
          newErrors.siteName = 'required';
        }
        if (!config.siteUrl.trim()) {
          newErrors.siteUrl = 'required';
        } else if (!/^https?:\/\/.+/.test(config.siteUrl)) {
          newErrors.siteUrl = 'invalid';
        }
        break;

      case 1: // R2 存储配置
        if (!config.r2Config.accountId.trim()) {
          newErrors.accountId = 'required';
        }
        if (!config.r2Config.accessKey.trim()) {
          newErrors.accessKey = 'required';
        }
        if (!config.r2Config.secretKey.trim()) {
          newErrors.secretKey = 'required';
        }
        if (!config.r2Config.bucket.trim()) {
          newErrors.bucket = 'required';
        }
        if (!config.r2Config.urlPrefix.trim()) {
          newErrors.urlPrefix = 'required';
        } else if (!/^https?:\/\/.+/.test(config.r2Config.urlPrefix)) {
          newErrors.urlPrefix = 'invalid';
        }
        break;

      case 2: // 管理员账户
        if (!config.admin.username.trim()) {
          newErrors.username = 'required';
        }
        if (!config.admin.email.trim()) {
          newErrors.email = 'required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.admin.email)) {
          newErrors.email = 'invalid';
        }
        if (!config.admin.password.trim()) {
          newErrors.password = 'required';
        } else if (config.admin.password.length < 6) {
          newErrors.password = 'min';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 下一步
  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, wizardSteps.length - 1));
    }
  };

  // 上一步
  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  // 完成配置
  const handleFinish = async () => {
    if (!validateStep(currentStep)) return;

    setIsLoading(true);
    try {
      // 构建初始化数据
      const setupData = {
        site: {
          name: config.siteName,
          description: config.siteDescription,
          url: config.siteUrl,
          defaultLanguage: 'zh-CN',
        },
        storage: {
          type: 'r2',
          endpoint: `https://${config.r2Config.accountId}.r2.cloudflarestorage.com`,
          bucket: config.r2Config.bucket,
          accessKeyId: config.r2Config.accessKey,
          secretAccessKey: config.r2Config.secretKey,
          region: config.r2Config.region,
          urlPrefix: config.r2Config.urlPrefix,
        },
        ui: {
          theme: 'system',
          language: 'zh-CN',
        },
        admin: {
          username: config.admin.username,
          email: config.admin.email,
          password: config.admin.password,
          nickname: config.admin.nickname,
        },
      };

      // 调用初始化 API
      const response = await setupSystem(setupData);

      if (response.data) {
        toast.success(t('pages.setupWizard.toasts.initSuccess'));
        navigate('/landing', { replace: true });
      } else {
        toast.error(t('pages.setupWizard.toasts.initFailed'));
      }
    } catch (_error: any) {
      toast.error(t('pages.setupWizard.toasts.initFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // 更新配置
  const updateConfig = (updates: Partial<SetupConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  // 测试 R2 连接
  const handleTestConnection = async () => {
    if (
      !config.r2Config.accountId ||
      !config.r2Config.accessKey ||
      !config.r2Config.secretKey ||
      !config.r2Config.bucket
    ) {
      toast.error(t('pages.setupWizard.toasts.pleaseFillR2'));
      return;
    }

    setIsTesting(true);
    try {
      const testData = {
        type: 'r2',
        endpoint: `https://${config.r2Config.accountId}.r2.cloudflarestorage.com`,
        bucket: config.r2Config.bucket,
        accessKeyId: config.r2Config.accessKey,
        secretAccessKey: config.r2Config.secretKey,
        region: config.r2Config.region,
        urlPrefix: config.r2Config.urlPrefix,
      };

      const response = await testConfig('storage', testData);

      if (response.data?.success) {
        toast.success(t('pages.setupWizard.toasts.testSuccess'));
      } else {
        toast.error(
          t('pages.setupWizard.toasts.testFailed', {
            error: response.data?.message || 'Unknown error',
          })
        );
      }
    } catch (_error: any) {
      toast.error(
        t('pages.setupWizard.toasts.testFailed', { error: _error.message || 'Unknown error' })
      );
    } finally {
      setIsTesting(false);
    }
  };

  // 渲染步骤内容
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // 基础配置
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="siteName">{t('pages.setupWizard.labels.siteName')}</Label>
              <Input
                id="siteName"
                value={config.siteName}
                onChange={(e) => updateConfig({ siteName: e.target.value })}
                placeholder={t('pages.setupWizard.placeholders.siteName')}
                className={errors.siteName ? 'border-destructive' : ''}
              />
              {errors.siteName && (
                <p className="text-destructive text-sm">
                  {t('pages.setupWizard.validation.siteNameRequired')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="siteDescription">
                {t('pages.setupWizard.labels.siteDescription')}
              </Label>
              <Textarea
                id="siteDescription"
                value={config.siteDescription}
                onChange={(e) => updateConfig({ siteDescription: e.target.value })}
                placeholder={t('pages.setupWizard.placeholders.siteDescription')}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="siteUrl">{t('pages.setupWizard.labels.siteUrl')}</Label>
              <Input
                id="siteUrl"
                value={config.siteUrl}
                onChange={(e) => updateConfig({ siteUrl: e.target.value })}
                placeholder={t('pages.setupWizard.placeholders.siteUrl')}
                className={errors.siteUrl ? 'border-destructive' : ''}
              />
              {errors.siteUrl && (
                <p className="text-destructive text-sm">
                  {errors.siteUrl === 'required'
                    ? t('pages.setupWizard.validation.siteUrlRequired')
                    : t('pages.setupWizard.validation.siteUrlInvalid')}
                </p>
              )}
            </div>
          </div>
        );

      case 1: // R2 存储配置
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="accountId">{t('pages.setupWizard.labels.accountId')}</Label>
              <Input
                id="accountId"
                value={config.r2Config.accountId}
                onChange={(e) =>
                  updateConfig({
                    r2Config: { ...config.r2Config, accountId: e.target.value },
                  })
                }
                placeholder={t('pages.setupWizard.placeholders.accountId')}
                className={errors.accountId ? 'border-destructive' : ''}
              />
              {errors.accountId && (
                <p className="text-destructive text-sm">
                  {t('pages.setupWizard.validation.accountIdRequired')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="accessKey">{t('pages.setupWizard.labels.accessKey')}</Label>
              <Input
                id="accessKey"
                value={config.r2Config.accessKey}
                onChange={(e) =>
                  updateConfig({
                    r2Config: { ...config.r2Config, accessKey: e.target.value },
                  })
                }
                placeholder={t('pages.setupWizard.placeholders.accessKey')}
                className={errors.accessKey ? 'border-destructive' : ''}
              />
              {errors.accessKey && (
                <p className="text-destructive text-sm">
                  {t('pages.setupWizard.validation.accessKeyRequired')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="secretKey">{t('pages.setupWizard.labels.secretKey')}</Label>
              <Input
                id="secretKey"
                value={config.r2Config.secretKey}
                onChange={(e) =>
                  updateConfig({
                    r2Config: { ...config.r2Config, secretKey: e.target.value },
                  })
                }
                placeholder={t('pages.setupWizard.placeholders.secretKey')}
                className={errors.secretKey ? 'border-destructive' : ''}
              />
              {errors.secretKey && (
                <p className="text-destructive text-sm">
                  {t('pages.setupWizard.validation.secretKeyRequired')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bucket">{t('pages.setupWizard.labels.bucket')}</Label>
              <Input
                id="bucket"
                value={config.r2Config.bucket}
                onChange={(e) =>
                  updateConfig({
                    r2Config: { ...config.r2Config, bucket: e.target.value },
                  })
                }
                placeholder={t('pages.setupWizard.placeholders.bucket')}
                className={errors.bucket ? 'border-destructive' : ''}
              />
              {errors.bucket && (
                <p className="text-destructive text-sm">
                  {t('pages.setupWizard.validation.bucketRequired')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="urlPrefix">{t('pages.setupWizard.labels.urlPrefix')}</Label>
              <Input
                id="urlPrefix"
                value={config.r2Config.urlPrefix}
                onChange={(e) =>
                  updateConfig({
                    r2Config: { ...config.r2Config, urlPrefix: e.target.value },
                  })
                }
                placeholder={t('pages.setupWizard.placeholders.urlPrefix')}
                className={errors.urlPrefix ? 'border-destructive' : ''}
              />
              {errors.urlPrefix && (
                <p className="text-destructive text-sm">
                  {errors.urlPrefix === 'required'
                    ? t('pages.setupWizard.validation.urlPrefixRequired')
                    : t('pages.setupWizard.validation.urlPrefixInvalid')}
                </p>
              )}
            </div>

            <div className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="w-full"
              >
                {isTesting
                  ? t('pages.setupWizard.buttons.testing')
                  : t('pages.setupWizard.buttons.testConnection')}
              </Button>
            </div>
          </div>
        );

      case 2: // 管理员账户
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">{t('pages.setupWizard.labels.username')}</Label>
              <Input
                id="username"
                value={config.admin.username}
                onChange={(e) =>
                  updateConfig({
                    admin: { ...config.admin, username: e.target.value },
                  })
                }
                placeholder={t('pages.setupWizard.placeholders.adminUsername')}
                className={errors.username ? 'border-destructive' : ''}
              />
              {errors.username && (
                <p className="text-destructive text-sm">
                  {t('pages.setupWizard.validation.usernameRequired')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('pages.setupWizard.labels.email')}</Label>
              <Input
                id="email"
                type="email"
                value={config.admin.email}
                onChange={(e) =>
                  updateConfig({
                    admin: { ...config.admin, email: e.target.value },
                  })
                }
                placeholder={t('pages.setupWizard.placeholders.adminEmail')}
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && (
                <p className="text-destructive text-sm">
                  {errors.email === 'required'
                    ? t('pages.setupWizard.validation.emailRequired')
                    : t('pages.setupWizard.validation.emailInvalid')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('pages.setupWizard.labels.password')}</Label>
              <Input
                id="password"
                value={config.admin.password}
                onChange={(e) =>
                  updateConfig({
                    admin: { ...config.admin, password: e.target.value },
                  })
                }
                placeholder={t('pages.setupWizard.placeholders.adminPassword')}
                className={errors.password ? 'border-destructive' : ''}
              />
              {errors.password && (
                <p className="text-destructive text-sm">
                  {errors.password === 'required'
                    ? t('pages.setupWizard.validation.passwordRequired')
                    : t('pages.setupWizard.validation.passwordMin')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nickname">{t('pages.setupWizard.labels.nickname')}</Label>
              <Input
                id="nickname"
                value={config.admin.nickname}
                onChange={(e) =>
                  updateConfig({
                    admin: { ...config.admin, nickname: e.target.value },
                  })
                }
                placeholder={t('pages.setupWizard.placeholders.adminNickname')}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* 头部 */}
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold">{t('pages.setupWizard.title')}</h1>
        <p className="text-muted-foreground">{t('pages.setupWizard.subtitle')}</p>
      </div>

      {/* 步骤指示器 */}
      <div className="mb-8 flex justify-center">
        <div className="flex items-center space-x-4">
          {wizardSteps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex items-center space-x-2">
                <div
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full border-2 transition-colors',
                    index === currentStep
                      ? 'border-primary bg-primary text-primary-foreground'
                      : index < currentStep
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground bg-background text-muted-foreground'
                  )}
                >
                  {index < currentStep ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </div>
                <div className="ml-2 hidden sm:block">
                  <p className="text-sm font-medium">{t(step.title)}</p>
                  <p className="text-muted-foreground text-xs">{t(step.description)}</p>
                </div>
              </div>
              {index < wizardSteps.length - 1 && (
                <div className="bg-muted-foreground/30 mx-2 h-0.5 w-8" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 主要内容 */}
      <Card className="rounded-none shadow-none">
        <CardContent className="p-6">{renderStepContent()}</CardContent>
      </Card>

      {/* 操作按钮 */}
      <div className="mt-8 flex justify-between">
        <Button variant="outline" onClick={handlePrev} disabled={currentStep === 0}>
          {t('pages.setupWizard.buttons.prev')}
        </Button>

        <div className="flex space-x-2">
          {currentStep === wizardSteps.length - 1 ? (
            <Button onClick={handleFinish} disabled={isLoading} className="min-w-[100px]">
              {isLoading
                ? t('pages.setupWizard.buttons.saving')
                : t('pages.setupWizard.buttons.finish')}
            </Button>
          ) : (
            <Button onClick={handleNext}>{t('pages.setupWizard.buttons.next')}</Button>
          )}
        </div>
      </div>
    </div>
  );
}
