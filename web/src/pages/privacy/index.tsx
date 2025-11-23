import LanguageSwitcher from '@/components/others/languageSwitcher';
import Logo from '@/components/others/logo';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

function PrivacyPolicyPage() {
  useTranslation();

  return (
    <div className="bg-background min-h-dvh font-sans">
      {/* Header */}
      <div className="bg-background/90 sticky top-0 z-10 w-full border-b px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Logo className="h-6 w-auto opacity-90" color="#07C160" />
            </Link>
          </div>
          <LanguageSwitcher />
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <article className="prose prose-neutral dark:prose-invert prose-lg prose-headings:font-bold prose-h1:text-4xl prose-h1:tracking-tight prose-a:text-primary hover:prose-a:text-primary/80 prose-img:rounded-xl prose-strong:text-foreground prose-li:marker:text-primary/50 mx-auto">
          <div className="mb-12">
            <h1 className="mb-4">隐私政策</h1>
            <p className="text-muted-foreground text-lg">
              生效日期：2025年11月23日
            </p>
          </div>

          <blockquote>
            欢迎使用 Rote（以下简称“本应用”）。我们非常重视您的隐私保护。本隐私政策旨在向您说明我们如何收集、使用、存储和分享您的个人信息，以及您享有的相关权利。请您在使用本应用前仔细阅读本政策。
          </blockquote>

          <h2>1. 我们收集的信息</h2>
          <p>为了向您提供服务，我们可能会收集以下类型的信息：</p>

          <h3>1.1 您主动提供的信息</h3>
          <ul>
            <li>
              <strong>账户信息</strong>：当您注册账户时，可能需要提供用户名、电子邮件地址、密码等信息。
            </li>
            <li>
              <strong>用户内容</strong>：您在使用本应用过程中创建、上传或存储的笔记、图片、标签等数据。
            </li>
            <li>
              <strong>个人资料</strong>：您在个人资料页面填写的昵称、简介、头像等信息。
            </li>
          </ul>

          <h3>1.2 自动收集的信息</h3>
          <ul>
            <li>
              <strong>设备信息</strong>：我们可能会收集您使用的设备型号、操作系统版本、唯一设备标识符等信息，用于一些匿名行为的标识。
            </li>
          </ul>

          <h2>2. 我们如何使用信息</h2>
          <p>我们将收集的信息用于以下目的：</p>
          <ul>
            <li>
              <strong>提供服务</strong>：为您提供笔记记录、存储、同步及社交分享等核心功能。
            </li>
            <li>
              <strong>安全保障</strong>：监测异常行为，防止欺诈和滥用，保障您的账户安全。
            </li>
            <li>
              <strong>沟通联系</strong>：向您发送服务通知、更新提示或回复您的咨询。
            </li>
          </ul>

          <h2>3. 信息共享与披露</h2>
          <p>我们承诺不会向第三方出售您的个人信息。仅在以下情况下，我们可能会共享您的信息：</p>
          <ul>
            <li>
              <strong>获得您的同意</strong>：在征得您明确同意的情况下共享。
            </li>
            <li>
              <strong>法律要求</strong>：根据法律法规、法院命令或政府机关的要求披露。
            </li>
            <li>
              <strong>服务提供商</strong>：与协助我们运营服务的第三方合作伙伴（如云存储服务商）共享必要信息，且要求其遵守本隐私政策。
            </li>
          </ul>

          <h2>4. 数据存储与安全</h2>
          <ul>
            <li>
              <strong>数据存储</strong>：您的信息将存储在安全的服务器上。
            </li>
            <li>
              <strong>安全措施</strong>：我们采取加密技术、访问控制等合理的安全措施来保护您的数据，防止未经授权的访问、泄露或篡改。
            </li>
            <li>
              <strong>数据保留</strong>：我们仅在提供服务所需的期限内保留您的个人信息，除非法律另有规定。
            </li>
          </ul>

          <h2>5. 您的权利</h2>
          <p>您对自己的个人信息享有以下权利：</p>
          <ul>
            <li>
              <strong>访问与更正</strong>：您可以随时登录账户查看和修改您的个人资料及内容。
            </li>
            <li>
              <strong>删除</strong>：您可以请求删除您的账户及相关数据。
            </li>
            <li>
              <strong>撤回同意</strong>：您可以随时撤回对我们收集和使用您信息的同意（但这可能影响您使用部分功能）。
            </li>
          </ul>

          <h2>6. 隐私政策的修订</h2>
          <p>我们可能会适时更新本隐私政策。更新后的政策将在本应用内发布，继续使用本应用即表示您同意受更新后的政策约束。</p>

          <h2>7. 联系我们</h2>
          <p>如果您对本隐私政策有任何疑问或建议，请通过以下方式联系我们：</p>
          <ul>
            <li>电子邮件：<a href="mailto:rabithua@gmail.com">rabithua@gmail.com</a></li>
            <li>
              GitHub Issues:{' '}
              <a
                href="https://github.com/rabithua/rote/issues"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://github.com/rabithua/rote/issues
              </a>
            </li>
          </ul>
        </article>
      </div>
    </div>
  );
}

export default PrivacyPolicyPage;
