import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

function ProductHunt() {
  const { t } = useTranslation('translation', { keyPrefix: 'components.productHunt' });

  const productHuntUrl = 'https://www.producthunt.com/products/rote-2';
  const scheduledDate = new Date('2025-12-25T08:01:00Z'); // December 25th, 2025 12:01 AM PST (UTC+8)
  const isScheduled = new Date() < scheduledDate;

  return (
    <Tooltip open={true}>
      <TooltipTrigger asChild>
        <Link
          to={productHuntUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative inline-flex h-10 items-center rounded-md border border-[#FF6154]"
        >
          <svg
            width="250"
            height="54"
            viewBox="0 0 250 54"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-auto"
            preserveAspectRatio="xMidYMid meet"
          >
            <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
              <g transform="translate(-130.000000, -73.000000)">
                <g transform="translate(130.000000, 73.000000)">
                  <text
                    fontFamily="Helvetica-Bold, Helvetica"
                    fontSize="9"
                    fontWeight="bold"
                    fill="#FF6154"
                  >
                    <tspan x="53" y="20">
                      {t('findUsOn')}
                    </tspan>
                  </text>
                  <text
                    fontFamily="Helvetica-Bold, Helvetica"
                    fontSize="21"
                    fontWeight="bold"
                    fill="#FF6154"
                  >
                    <tspan x="52" y="40">
                      Product Hunt
                    </tspan>
                  </text>
                  <g transform="translate(11.000000, 12.000000)">
                    <path
                      d="M31,15.5 C31,24.0603917 24.0603917,31 15.5,31 C6.93960833,31 0,24.0603917 0,15.5 C0,6.93960833 6.93960833,0 15.5,0 C24.0603917,0 31,6.93960833 31,15.5"
                      fill="#FF6154"
                    />
                    <path
                      d="M17.4329412,15.9558824 L17.4329412,15.9560115 L13.0929412,15.9560115 L13.0929412,11.3060115 L17.4329412,11.3060115 L17.4329412,11.3058824 C18.7018806,11.3058824 19.7305882,12.3468365 19.7305882,13.6308824 C19.7305882,14.9149282 18.7018806,15.9558824 17.4329412,15.9558824 M17.4329412,8.20588235 L17.4329412,8.20601152 L10.0294118,8.20588235 L10.0294118,23.7058824 L13.0929412,23.7058824 L13.0929412,19.0560115 L17.4329412,19.0560115 L17.4329412,19.0558824 C20.3938424,19.0558824 22.7941176,16.6270324 22.7941176,13.6308824 C22.7941176,10.6347324 20.3938424,8.20588235 17.4329412,8.20588235"
                      fill="#FFFFFF"
                    />
                  </g>
                </g>
              </g>
            </g>
          </svg>
        </Link>
      </TooltipTrigger>
      {isScheduled ? (
        <TooltipContent side="top">
          <p className="text-sm">
            {t('scheduledDate', {
              date: scheduledDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'America/Los_Angeles',
              }),
            })}
          </p>
        </TooltipContent>
      ) : (
        <TooltipContent side="top">
          <p className="text-sm">{t('votePrompt')}</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
}

export default ProductHunt;
