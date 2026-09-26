# LLMs in the Heart of Differential Testing: A Case Study on a Medical Rule Engine

Erblin Isaku, Christoph Laaber, Hassan Sartaj, Shaukat Ali, Thomas Schwitalla, Jan F. Nygård  
2024  
arXiv: 2404.03664v1

## Abstract.

The Cancer Registry of Norway (CRN) uses an automated cancer registration support system (CaReSS) to support core cancer registry activities, i.e, data capture, data curation, and producing data products and statistics for various stakeholders. *GURI* is a core component of CaReSS, which is responsible for validating incoming data with medical rules. Such medical rules are manually implemented by medical experts based on medical standards, regulations, and research. Since large language models (LLMs) have been trained on a large amount of public information, including these documents, they can be employed to generate tests for *GURI*. Thus, we propose an LLM-based test generation and differential testing approach (LLMeDiff) to test *GURI*. We experimented with four different LLMs, two medical rule engine implementations, and $58$ real medical rules to investigate the hallucination, success, time efficiency, and robustness of the LLMs to generate tests, and these tests’ ability to find potential issues in *GURI*. Our results showed that *GPT-3.5* hallucinates the least, is the most successful, and is generally the most robust; however, it has the worst time efficiency. Our differential testing revealed 22 medical rules where implementation inconsistencies were discovered (e.g., regarding handling rule versions). Finally, we provide insights for practitioners and researchers based on the results.

## 1 Introduction

The cancer registration support system (CaReSS) is a real-world socio-technical software system developed and operated by the Cancer Registry of Norway (CRN), a public organization in Norway under the National Institute of Public Health (NIPH). CaReSS receives cancer patient data through cancer messages from other public and private entities, including hospitals, laboratories, and health registries (e.g., national patient registry). Such data is then processed by CaReSS to produce outputs (including data and statistics) for its end users, such as the public, researchers, and policymakers.

One core functionality of CaReSS is to validate incoming cancer messages and medical data with a dedicated rule validation software system called *GURI*, which checks the correctness of received cancer messages, validates the data with various medical rules, aggregates individual cancer messages into cancer cases, and validates the aggregation. The rules are manually defined by medical coders based on various standards and regulations, such as International Classification of Diseases (ICD)-10 (10^{th} edition), ICD-O-2 (ICD for Oncology, 2^{nd} edition) for solid tumors, and ICD-O-3 (ICD for Oncology, 3^{rd} edition) for non-solid tumors. Extensively testing *GURI* is important since an incorrect implementation would produce erroneous data or statistcs, which are used in medical research, monitoring and evaluation of cancer care.

As large language models (LLMs) have been trained on a large amount of public information, including the standards, regulations, and other documents that are the sources for specifying the medical rules, we employ these LLMs to generate tests for these medical rules. Consequently, we developed an LLM-based differential testing approach called LLMeDiff to find potential faults in *GURI*. An LLM is used to generate tests from medical rules (that yield *Pass*, *Fail*, and *NotApplied* results for each rule), which are then executed on *GURI* and a simple reference implementation (*Dvare++*). A mismatch between the outputs from these two flags a potential inconsistency stemming from an implementation issue in *GURI*.

In our previous works, we studied a state-of-the-art test generation tool (i.e., EvoMaster [3]) applied to *GURI* [26], reduced its number of executed tests with machine learning (ML) classifiers [21], and built cyber-cyber digital twins of *GURI* [29]. In contrast, in this paper, we improve on our previous works by

(1) leveraging LLMs to generate valid medical data as test inputs, (2) addressing the oracle problem of rule results through differential testing with a reference implementation, and (3) reducing the number of executed tests against *GURI* by only generating three tests per rule.

We experimented LLMeDiff by selecting four LLMs (i.e., *Mistral*, *Llama2*, *Mixtral*, and *GPT-3.5*), $58$ real medical rules and their $322$ mutations, and two rule engine implementations (i.e., *GURI* and *Dvare++*). We focused on two perspectives:

(1) how effective, efficient, and robust the selected LLMs are in generating tests from medical rules; and (2) how many potential issues we can identify in the implementation of *GURI* with our differential testing approach.

Our results showed that LLMs are highly effective in generating medical rule tests. In particular, *GPT-3.5* is the most effective LLM with hardly any hallucinations (i.e., mean completion rate of $97.07050$%) and being successful in generating *Pass* ($82.10779$%), *Fail* ($65.80779$%), and *NotApplied* ($79.19697$%) tests. However, *GPT-3.5* is also the least efficient model with $15.496024\text{\,}\mathrm{s}$ compared to the fastest models, i.e., *Mixtral* with $7.069893\text{\,}\mathrm{s}$ and *Mistral* with $7.779271\text{\,}\mathrm{s}$. In terms of robustness, *GPT-3.5* performs the best for *Pass* tests with $92.25741$% and equally to *Mixtral* and *Mistral* for *NotApplied* tests with $86.20417$%. Only for *Fail* tests, *GPT-3.5* with $77.40914$% is inferior to *Mistral* and *Mixtral* with both having $86$%. Finally, regarding the differential testing results, we observe that *Mixtral* has the highest number of matches, while *Mistral* has the highest number of mismatches per rule. A total of 44 rule mismatches between *GURI* results and *Dvare++* for *Mistral*, followed by *GPT-3.5* with 32, *Llama2* with 29 and *Mixtral* with 27. While not all mismatches can be considered faults, our analysis reveals 22 rules that show inconsistencies in terms of handling either rule versions, date format, or variable dependencies.

These results suggest that LLMs are effective rule test generators to discover mismatches with differential testing, improving the current state of practice at the CRN. Whether a mismatch is an actual fault still requires manual root cause analysis by the CaReSS developers.

## 2 Real-World Application Context

The CRN compiles information on cancer patients, covering data related to diagnosis and medical treatments sourced from various healthcare organizations (e.g., hospitals and laboratories) as cancer messages. The CRN created CaReSS to analyze and validate cancer messages and offer decision support to stakeholders like policy makers and researchers. The accuracy of the decisions made with CaReSS relies on the validity of the cancer messages it stores. To validate cancer messages, the CRN developed a subsystem of CaReSS named *GURI*—our application context. *GURI* is a web-based system that provides several representational state transfer (REST) application programming interface (API) endpoints corresponding to various functionalities. One of the endpoints is the validation endpoint (`/api/messages/validation`) for validating cancer messages against medical rules.

*Dvare^1* is a rule-expression language engine that runs the rules on the data and asserts the results into `true` or `false` depending on if any of the condition matches. *GURI* employs *Dvare* as the underlying engine to evaluate cancer messages against medical rules. While *Dvare* yields a Boolean result, *GURI* categorizes the results based on logical operations, particularly the `implies` operator. Consider an example rule with two operands joined by an `implies` operation, as illustrated in Fig. 1. In this scenario, *GURI* handles the rules as follows:

(1) If the `LeftOperand` is `true`, the rule is applied and can be either *Pass* or *Fail* depending on the `RightOperand` (`true` for *Pass*, and `false` for *Fail*). (2) If the `LeftOperand` is `false`, the rule is *NotApplied*, irrespective of the `RightOperand`.

This categorization enables *GURI* to present rule validation outcomes with enhanced clarity for analysis and prediction within CaReSS.

**Figure 1.** An example medical rule

Testing *GURI* is essential to ensure the accuracy of the cancer data and statistics produced by CaReSS [21]. The challenges of testing *GURI* are as follows. **(1) Evolution:** *GURI* and *Dvare* continuously evolve in response to changing cancer messages format and medical rules dictated by standards/regulations or through cancer research. **(2) High-cost:** Testing multiple evolving implementations of *GURI* with various underlying *Dvare* versions incurs high time and resource costs. **(3) Labor-intensive:** Manual testing of each version *GURI* in different development phases is a laborious task. Therefore, a cost-effective and automated approach is necessary to test the evolving *GURI* [27]. **(4) Absence of Test Oracles:** For medical rule testing, there are no precise test oracles to determine whether the rules are implemented correctly, posing additional challenges for automated testing.

## 3 Approach

**Figure 2.** LLMeDiff Overview

**Listing 1.** LLM Prompt

```
            1
            
            
            
            
            
            
            
          system_msg = f"""

            2
            
            
            
            
            
            
            
          You are a cautious assistant, an expert in medical rules.

            3
            
            
            
            
            
            
            
          To complete the user task, you need to strictly follow these steps:

            4

            5
            
            
            
            
            
            
            
          Follow these steps precisely:

            6

            7
            
            
            
            
            
            
            
          Step 1: Clearly articulate the rule in natural language as you were explaining it to a child.

            8
            
            
            
            
            
            
            
          Step 2: Identify the variable names and generate values according to the rule’s conditions.

            9
            
            
            
            
            
            
            
          - For satisfying the rule, provide a dictionary (’satisfying_case’) including all variables specified in the rule.

            10
            
            
            
            
            
            
            
          - For violating the rule, alter ONLY the implied value while keeping other values unchanged; output a dictionary (’violation_case’) for this.

            11
            
            
            
            
            
            
            
          - For cases that do not apply to the rule, provide a dictionary (’invalid_case’) with invalid values that do not meet any rule condition.

            12

            13
            
            
            
            
            
            
            
          Step 3: Double check the use of original variable names as properties, and maintain only one value for each variable. Refactor the dictionaries if needed.

            14

            15
            
            
            
            
            
            
            
          Step 4: Express your confidence level on the generated test case using a score from 0% to 100%. Output ’confidence_score’ as a string.

            16

            17
            
            
            
            
            
            
            
          Step 5: Format and output the data as a JSON object. Enclose all properties in double quotes.

            18
            
            
            
            
            
            
            
          """

            19

            20
            
            
            
            
            
            
            
          user_msg = f"""

            21
            
            
            
            
            
            
            
          Identify the variables and values in the given rule and create a JSON object with the following properties: satisfying_case, violation_case, invalid_case, and confidence_score.

            22

            23
            
            
            
            
            
            
            
          Rule: {rule}

            24
            
            
            
            
            
            
            
          """
```

Figure 2 shows LLMeDiff’s overview in two stages:

(1) medical rule test generation and (2) differential testing of *GURI*.

### Test Generation

This stage uses an LLM, which takes a prompt and a set of rules as input. LLMeDiff executes one prompt for each rule, resulting in three tests per rule: one *Pass*, one *Fail*, and one *NotApplied* test. A test has (only) the variable values that let the rule *Pass*, *Fail*, or *NotApplied*.

shows the prompt divided into a system and user part. In the system part (`system_msg`), we set up the LLM to follow these steps: `fnum@@desciitemStep 1:` be precise; `fnum@@desciitemStep 2:` identify rule variables and generate tests: (1) *Pass*(`satisfying_case`), (2) *Fail*(`violating_case`), and (3) *NotApplied*(`invalid_case`); `fnum@@desciitemStep 3:` do not be repetitive; `fnum@@desciitemStep 4:` express your confidence (`confidence_score`); and `fnum@@desciitemStep 5:` generate a JavaScript Object Notation (JSON) object as the output. Note that we use different terms in the prompt, as the rules are similar to constraints in propositional logic and, hence, we expect the LLM to understand these terms better than the terms specific to *GURI*. In the user part (`user_msg`), we instruct the LLM to generate the three tests for a given rule, for which the prompt can be parameterized (`{rule}`).

**Differential Testing**

In this stage, we execute the tests against two system under tests (SUTs):

`fnum@@desciitemStep 5:` *Dvare++ and* `fnum@@desciitemStep 5:` *GURI*. *Dvare++* is a simplified reference implementation of *GURI* that internally uses the *Dvare* rule engine and adds a wrapper around it to return the same rule results as *GURI*. *GURI* is the real-world web-based rule engine of CaReSS, which validates and aggregates cancer messages through REST endpoints. As the generated tests only contain the variables of the rule they test, LLMeDiff adds a preprocessing step before sending the tests to *GURI*, which embeds a test in a cancer message (formatted as JSON) containing all the variables *GURI* requires. For this, it uses a predefined set of values for the “other” variables not part of a test, which are randomly picked and do not yield an error. These values remain the same across all the tests. Differential testing solves the oracle problem [5] by sending the same input to two (or more) SUTs that should have the same outputs and comparing whether the actual outputs are identical [31]. When automatically testing medical rule engines, it is unclear how to generate test oracles, as we do not know the expected rule result for a given variable assignment [26]; hence, we can leverage differential testing to test *GURI*. For this, LLMeDiff sends the same rule tests to *Dvare++* and *GURI* and checks whether the rule results match. In case of a match, we consider the medical rule and the integration in *GURI* to be correct; otherwise, we report to the CRN developers that there was a mismatch for a certain rule when running a certain test.

**4. Experimental Evaluation**

To evaluate LLMeDiff, we perform a laboratory experiment [37] on four LLMs and $58$ real-world medical rules from the CRN.

**4.1. Research Questions**

Our experiment investigates the following research questions (RQs). **RQ1:** How effective and efficient are LLMs in generating tests from medical rules? **RQ2:** How robust are LLMs when generating tests? **RQ3:** To what extent can the generated tests be used for differential testing of a real-world medical rule engine? **RQ1** studies the differences in the abilities of the selected LLMs in generating tests from three aspects: (1) hallucinations, i.e., syntactically invalid outputs; (2) successful generations, i.e., semantically correct outputs (e.g., a test that should pass actually passes); and (3) time efficiency. **RQ2** focuses on the robustness of the selected LLMs to study their trustworthiness when generating tests for slightly mutated rules. **RQ3** is designed to investigate the effectiveness of the generated tests in evaluating the *GURI* system, thereby studying the applicability of LLMeDiff to a real-world system.

**4.2. LLM Selection and Settings**

We selected four LLMs: (1) Mistral 7B denoted as *Mistral* [23], (2) Llama 2 13B denoted as *Llama2* [39], (3) Mixtral 8x7b denoted as *Mixtral* [24], and (4) GPT-3.5 denoted as *GPT-3.5* [33]. We selected these models while considering availability, diversity, performance across general-purpose tasks, and popularity among the AI community. *GPT-3.5* from OpenAI, is a generative pre-trained transformer, while *Llama2*, from Meta, is a pre-trained and fine-tuned LLM with 13 billion parameters. We choose *Mistral* from Mistral AI for its good performance in reasoning, mathematics, and code generation, outperforming *Llama2* on multiple benchmarks [23]. Furthermore, *Mixtral*, a sparse mixture of experts model with open weights, distinguishes itself by matching or surpassing *GPT-3.5* on various tasks [24]. Its impressive performance and widespread popularity within the AI community, particularly on platforms like HuggingFace^2 were the reasons to select it. We used the same temperature setting and number of repetitions for all the LLMs. While different temperatures may impact the output of LLMs, specific guidelines and recommendations remain general; varying from 0 to 2, where higher values indicate more random or creative generation [48]. Although more empirical studies are needed, it is common to set the temperature around 0.7: (1) Llama 2 [39] uses 0.1 and 0.8 as defaults depending on the task and benchmark; (2) the OpenAI API reference^3 defaults to 0.7; (3) open-source frameworks such as The Rasa Community^4 use 0.7; (4) GTP-4 uses 0.6 as their “best-guess” [32]; (5) academic studies often use 0.7, aiming to balance determinism and creativity [28, 50, 9]. Consequently, we employed 0.7 for all four models. To account for randomness, we let the LLMs generate tests for each rule $30$ times [4]. Regarding the prompt (see Section 3), only *Llama2* and *GPT-3.5* support separate system and user parts. For *Mistral* and *Mixtral*, we concatenate the two parts into a single prompt. The three models *Mistral*, *Llama2*, and *Mixtral* are accessed through the AI platform fireworks.ai^5, while *GPT-3.5* which is accessible only on the OpenAI platform^6.

**4.3. Medical Rules and Rule Mutations**

We selected a subset of the CRN’s rules, i.e., $70$ validation rules, of which we excluded $22$ that contain complex structures, such as user-defined functions instead of variables, which would require access to the functions (as they are not part of the rule) and add complexity to *Dvare++*. In total, we use $58$ rules in our study. In addition, to enlarge the studied rule set in RQ1 and compute the robustness metrics in RQ2, we define a set of mutation operators on medical rules (see Table 1), inspired by previous research [36, 22]. The mutation operators consider (1) changing logical operators (*CO*, *NI*, and *ACO*), set containment (*RI*), and built-in functions (*RSE*); (2) swapping indices (*SSI*) and rule clauses (*SR*); and (3) altering dates (*ACO*). We apply each mutation operator one at a time on every rule at every possible location. Therefore, one mutation operator may be applied multiple times to the same rule when there are multiple possible locations, e.g., if a rule contains three `and` operators, we would apply *CO* three times. In total, we retrieve $322$ mutated rules from the $58$ rules. Note that we use the mutated rules only to evaluate the tests generated by the LLMs in RQ1 and RQ2 and not in RQ3, as *GURI* does not have these rules implemented and, hence, would not return the expected test results. Table 1. Mutation operators

**Table.**

|  |  |  |
| --- | --- | --- |
| **Name** | ID | **Description** |
| Alter Comparison Operators | *ACO* | Modify `>` to `<` and `<=` to `>=` and vice versa. |
| Alter Date | *AD* | Alter the date by $\pm 1$ year, $\pm 1$ month, or $\pm 1$ day. |
| Change Operator | *CO* | Change `and` to `or` and vice versa. |
| Negate Inequality | *NI* | Change `=` to `!=` and vice versa. |
| Reverse Inclusion | *RI* | Change `in` condition to `notIn` or vice versa. |
| Replace Startswith/Endswith | *RSE* | Change `startswith` to `endswith` and vice versa. |
| Swap Rule | *SR* | If `Rule A implies Rule B` then change it to `Rule B implies Rule A`. |
| Swap Substring Indices | *SSI* | If `substring(i,j)` then change it to `substring(j,i)`. |

**4.4. Evaluation Metrics**

In this section, we define the metrics used to answer the RQs.

**4.4.1. RQ1**

We follow previous works [7, 2, 14] and use EM to check if the completion (LLM test generation) matches exactly the expected output. An exact match is considered when the LLM can generate syntactically correct tests for all three types, i.e., *Pass*, *Fail*, and *NotApplied*. This metric allows us to assess the LLM’s ability to produce valid tests, evaluating how accurately the LLM follows the instructions in the prompt. Considering instruction inconsistency as an indicator of potential hallucination [19], we gain insight into the model’s performance in handling different medical rules and maintaining consistency with the given instructions. First, we introduce the completion rate metric in Eq. 1, computed as the ratio of Exact Matches (EM) to the total expected cases ($T_{expected}$), representing the overall repetitions. We use ${\#EM}$ to denote the number of times an LLM successfully generated valid tests.

$$
CR=\frac{\#EM}{T_{expected}} \tag{1}
$$

Second, we study each LLM’s test generation success from two combined aspects: (1) how successful they are in producing exactly matched outputs and (2) how many of the successfully matched outputs are true positives. This is calculated as the Euclidean distance between the results of an LLM from these two aspects and the maximum possible values for them. Assuming the two points $A_{t}(\#Observed,\#True)$, and $B(T_{expected},T_{expected})$. $A_{t}$ represents the results for an LLM for a rule for a test type $t$ (e.g., *Pass*), for $T_{expected}$ repetitions. $\#Observed$ is the number of times out of $T_{expected}$, the LLM produced exactly matched outputs, whereas $\#True$ represents how many matched outputs were true positives. Assuming $T_{expected}=30$, B will be $B(30,30)$. As an example—for point $A_{pass}$ (25, 15) means that we observe only 25 tests out of 30 (i.e., the maximum) for a specific rule under *Pass* and out of 25 observations only 15 tests are actually *Passing* by *Dvare++*. The Euclidean distance $ED_{r}$ is then defined in Eq. 2.

$$
\begin{split}ED_{r}=\sqrt{(T_{expected}-\#Observed)^{2}+(T_{expected}-\#True)^{2}}\end{split} \tag{2}
$$

$ED_{r}$ is then normalized using min-max normalization where the *minimal distance* and *maximal distance* are calculated based on the constant coordinates for distance calculation $(0,0)$ and $(T_{expected},T_{expected})$, respectively. Finally, the success index $SI_{r}$ for a particular rule $r$ is calculated in Eq. 3.

$$
SI_{r}=(1-NormalizedDistance)\times 100 \tag{3}
$$

$SI_{r}$ represents the success percentage, with higher values indicating greater success. Derived $SI_{r}$, we denote $SI_{pass}$, $SI_{fail}$, and $SI_{NotApplied}$ as the sets of success indices across all the rules per test type (*Pass*, *Fail*, and *NotApplied*). Third, we measure the time from sending the request to the LLM platform to receiving the response, including the model inference time and other communication overheads (e.g., network). Throughout the paper, we refer to this time as the inference time $t_{infer}$.

**4.4.2. RQ2**

We assess the robustness of an LLM by introducing minor changes to each rule and study how much the outputs of the original and mutated rules differ. A similar way of assessing the robustness of LLMs has been employed by Hyun et al. [20]. To this end, we calculate the average absolute difference between the success indices of each rule in the original and mutated sets for each test type. The result is then subtracted from 1 to represent the robustness index, where a higher value indicates greater robustness for the individual rules within the test type. Let $RI_{rt}$ be the robustness index for a specific rule $r$ of test type $t$, as defined in Eq. 4.

$$
\begin{split}RI_{rt}=1-\frac{1}{n_{rt}}\sum_{j=1}^{n_{rt}}\left|SI_{rt}^{original}-SI_{rtj}^{mutated}\right|\end{split} \tag{4}
$$

where

`fnum@@desciitemStep 5:` $SI_{rt}^{\text{original}}$is the success index for rule $r$ of test type $t$ on the original set; `fnum@@desciitemStep 5:` $SI_{rtj}^{\text{mutated}}$is the success index for the $j$-th mutated rule for rule $r$ of test type $t$; and `fnum@@desciitemStep 5:` $n_{rt}$is the total number of mutated rules for the original rule $r$ of test type $t$. Derived $RI_{rt}$, we denote $RI_{pass}$, $RI_{fail}$, and $RI_{NotApplied}$ as the sets of robustness indices across all the rules per test type (*Pass*, *Fail*, and *NotApplied*).

**4.4.3. RQ3**

Regarding differential testing, we use *D* to denote the *Dvare++* results and *G* to denote the *GURI* results. We define the metrics for a match and a mismatch as follows: $Match$ as the set of rule numbers $R$ associated with matches for a specific result, see Eq. 5. A match is considered when both systems return the same result for the same test data.

$$
\begin{split}Match&=R\cap(D\cap G)\end{split} \tag{5}
$$

Similarly, we define $Mismatch$ in Eq. 6 as the set of rule numbers $R$ associated with mismatches for a specific result.

$$
\begin{split}Mismatch&=R\cap(D\cup G)\end{split} \tag{6}
$$

**4.5. Statistical Analyses**

We use hypothesis testing and effect sizes to statistically evaluate our result observations. A set of observations is a distribution of metric values, e.g., by an LLM. Depending on the RQ, we consider different observations analyzed by the statistical tests. We follow the best practice [4]. We use the non-parametric Kruskal-Wallis H test [25] to compare multiple observation sets, which is an extension of the pair-wise Mann-Whitney U test. The null hypothesis $H_{0}$ states no statistical difference among the distribution sets’ ranks. The alternative hypothesis $H_{1}$ states that there is a difference. If we can reject $H_{0}$ and accept $H_{1}$, we perform Dunn’s post-hoc test [13] to identify for which pairs there is a difference. We set the significance level to $\alpha=0.01$ and control the false discovery rate with the Benjamini-Yekutieli procedure [6] for multiple comparisons. We additionally perform the Vargha-Delaney $\hat{A}_{12}$ [41] to assess the effect size magnitude. Two observation sets are stochastically equivalent if $\hat{A}_{12}$ $=0.5$. If $\hat{A}_{12}$ $>0.5$, the first observation is stochastically better than the second observation; otherwise $\hat{A}_{12}$ $<0.5$. We further divide $\hat{A}_{12}$ into magnitude categories, based on $\hat{A}^{scaled}_{12}=(\hat{A}_{12}-0.5)*2$ [18]: **negligible:** $=|\hat{A}^{scaled}_{12}|<0.147$, **small:** $=0.147\leq|\hat{A}^{scaled}_{12}|<0.33$, **medium:** $=0.33\leq|\hat{A}^{scaled}_{12}|<0.474$, and **large:** $=|\hat{A}^{scaled}_{12}|\geq 0.474$. All results are considered statistically significant if the *p*-value is below $\alpha$ and the effect size is non-negligible.

**4.6. Threats to Validity**

**Construct Validity**

The threats to construct validity are mostly concerned with the defined metrics. We define effectiveness in terms of completion rate $CR$ and success index $SI$, and efficiency with the inference time $t_{infer}$. Our robustness metric $RI$ builds on rule mutations. Hence, the choice of mutation operators, which is based on previous work [36, 22], is key to the validity of $RI$. Other metrics might lead to different results. $t_{infer}$ includes the Hypertext Transfer Protocol (HTTP) request sent to the LLM platform (i.e., OpenAI or Fireworks.ai) and not only the model inference time. However, the HTTP time should be similar across the models, as we use the same platform for *Llama2*, *Mistral*, and *Mixtral*, only for *GPT-3.5* we use OpenAI’s API.

**Internal Validity**

Internal validity is about the experiment setup. We use hosted LLMs and do not run the models ourselves, which removes our control over how the models are run. For example, we can not be sure that model instances and sessions are not shared across users and HTTP requests, and, therefore, information from previous prompts may leak into our results. However, we studied the platforms’ documentation and are quite certain that each request is treated as its own session and that no leakage should happen. Another threat is the LLM temperature setting, where we picked a common value and kept it consistent across the LLMs. The results would likely change with different temperatures. Moreover, as LLMs are stochastic in nature, our results might also suffer from random artifacts. To address this threat, we follow the best practice from search-based software engineering and repeat our experiment $30$ times and use appropriate statistical tests [4]. Using different statistical procedures to draw conclusions might lead to slightly different results. Finally, every piece of software is prone to bugs; so is our experimentation pipeline. We carefully reviewed our scripts and results and reran the experiments multiple times to ensure we do not experience critical bugs.

**External Validity**

Threats to external validity relate to the generalizability of our results, in particular, beyond the LLMs, medical rules, mutation operators, and the rule engine *GURI*. We select a representative set of LLMs that have shown strong performance in general-purpose tasks and widespread popularity in the AI community. In terms of rules, we select a subset of *GURI*’s validation rules. Our results might change for different validation rules, aggregation rules, or different rules from other cancer registries, potentially from other countries. Finally, we perform a laboratory experiment, i.e., we run the tests against a standalone version of *GURI* in an isolated setting, and do not perform a field experiment, where the tests are executed against the real *GURI*.

**5. Results and Analyses**

In this section, we discuss the results for the RQs.

**5.1. RQ1: Effectiveness and Efficiency**

This section investigates the completion rate $CR$, success index $SI$, and inference time $t_{infer}$ across the LLMs. Figure 3. Completion rates for all the rules per LLM. Table 2. Statistical tests of the completion rates, success indices per test type, and inference times per LLM

**Table.**

|  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- |
| Metric | Model 1 | Model 2 | Comp. | *p*-value | $\hat{A}_{12}$ | Magnitude |
| $CR$ | *Mistral* | *Llama2* | worse | $7.99\text{\times}{10}^{-88}$ | $0.0586$ | large |
|  | *Mistral* | *Mixtral* | equal | $0.653$ | $0.456$ | negligible |
|  | *Mistral* | *GPT-3.5* | worse | $6.39\text{\times}{10}^{-144}$ | $0.0213$ | large |
|  | *Llama2* | *Mixtral* | better | $1.44\text{\times}{10}^{-78}$ | $0.939$ | large |
|  | *Llama2* | *GPT-3.5* | worse | $3.46\text{\times}{10}^{-08}$ | $0.303$ | medium |
|  | *Mixtral* | *GPT-3.5* | worse | $4.26\text{\times}{10}^{-132}$ | $0.0215$ | large |
| $SI_{\textit{Pass}}$ | *Mistral* | *Llama2* | worse | $7.03\text{\times}{10}^{-33}$ | $0.266$ | medium |
|  | *Mistral* | *Mixtral* | worse | $0.000464$ | $0.369$ | small |
|  | *Mistral* | *GPT-3.5* | worse | $6.11\text{\times}{10}^{-72}$ | $0.156$ | large |
|  | *Llama2* | *Mixtral* | better | $2.69\text{\times}{10}^{-16}$ | $0.699$ | medium |
|  | *Llama2* | *GPT-3.5* | worse | $5.44\text{\times}{10}^{-09}$ | $0.369$ | small |
|  | *Mixtral* | *GPT-3.5* | worse | $7.56\text{\times}{10}^{-46}$ | $0.171$ | large |
| $SI_{\textit{Fail}}$ | *Mistral* | *Llama2* | worse | $5.85\text{\times}{10}^{-08}$ | $0.404$ | small |
|  | *Mistral* | *Mixtral* | worse | $1.43\text{\times}{10}^{-11}$ | $0.312$ | medium |
|  | *Mistral* | *GPT-3.5* | worse | $3.23\text{\times}{10}^{-41}$ | $0.234$ | large |
|  | *Llama2* | *Mixtral* | equal | $0.419$ | $0.488$ | negligible |
|  | *Llama2* | *GPT-3.5* | worse | $7.11\text{\times}{10}^{-15}$ | $0.337$ | small |
|  | *Mixtral* | *GPT-3.5* | worse | $9.92\text{\times}{10}^{-11}$ | $0.335$ | small |
| $SI_{\textit{NotApplied}}$ | *Mistral* | *Llama2* | worse | $1.03\text{\times}{10}^{-19}$ | $0.314$ | medium |
|  | *Mistral* | *Mixtral* | worse | $1.28\text{\times}{10}^{-05}$ | $0.352$ | small |
|  | *Mistral* | *GPT-3.5* | worse | $8.34\text{\times}{10}^{-74}$ | $0.143$ | large |
|  | *Llama2* | *Mixtral* | better | $7.59\text{\times}{10}^{-06}$ | $0.625$ | small |
|  | *Llama2* | *GPT-3.5* | worse | $4.63\text{\times}{10}^{-19}$ | $0.294$ | medium |
|  | *Mixtral* | *GPT-3.5* | worse | $3.02\text{\times}{10}^{-42}$ | $0.177$ | large |
| $t_{infer}$ | *Mistral* | *Llama2* | better | $0$ | $0.234$ | large |
|  | *Mistral* | *Mixtral* | equal | $3.32\text{\times}{10}^{-19}$ | $0.544$ | negligible |
|  | *Mistral* | *GPT-3.5* | better | $0$ | $0.173$ | large |
|  | *Llama2* | *Mixtral* | worse | $0$ | $0.82$ | large |
|  | *Llama2* | *GPT-3.5* | better | $3.63\text{\times}{10}^{-182}$ | $0.346$ | small |
|  | *Mixtral* | *GPT-3.5* | better | $0$ | $0.139$ | large |

**Completion Rate**

Figure 3 depicts the $CR$ across the LLMs. We observe that *GPT-3.5* performs the best with a mean $CR$ of $97.07050$%, indicating that it almost never hallucinates and always generates the correct JSON test output. The second-best model is *Llama2* with $92.12339$%, before there is a considerable drop for *Mixtral* and *Mistral* to $63.60529$% and $61.35958$%, respectively. The statistical tests, depicted in Table 2, support these observations: *GPT-3.5* is statistically better than *Llama2* with medium and *Mixtral* and *Mistral* with large effect sizes. Figure 4. Success indices for all the rules per test type and LLM.

**Success Index**

Figure 4 shows the success indices $SI_{\textit{Pass}}$, $SI_{\textit{Fail}}$, $SI_{\textit{NotApplied}}$ for the *Pass*, *Fail*, and *NotApplied* tests, respectively, across the LLMs. Similar to the completion rates, we observe that *GPT-3.5* performs the best, with a mean $SI_{\textit{Pass}}$ of $82.10779$%, $SI_{\textit{Fail}}$ of $65.80779$%, and $SI_{\textit{NotApplied}}$ of $82.12125$%, followed by *Llama2*, *Mixtral*, and *Mistral*. The statistical tests confirm *GPT-3.5*’s superiority: for all three test types, it is better than all the other LLMs, at least with a small effect size. While the LLMs perform similarly on $SI_{\textit{Pass}}$ and $SI_{\textit{NotApplied}}$, they exhibit a considerable drop on $SI_{\textit{Fail}}$, except *Mixtral* which performs similarly across the three metrics. This shows that the LLMs struggle more to generate *Fail* tests, which might be due to the structure of the rules, where the LLM must satisfy the left clause of the implication while it must falsify the right clause (see Section 2). Figure 5. Inference times for all the rules per LLM.

**Inference Time**

In terms of efficiency, Fig. 5 plots the inference times $t_{infer}$ for all the rules across the LLMs. We observe that the most effective LLM, i.e., *GPT-3.5*, is the least efficient one, with a mean $t_{infer}$ of $15.496024\text{\,}\mathrm{s}$. The fastest LLMs are *Mixtral* with $7.069893\text{\,}\mathrm{s}$ and *Mistral* with $7.779271\text{\,}\mathrm{s}$, followed by *Llama2* with $11.568463\text{\,}\mathrm{s}$. In terms of statistical tests, *Mixtral* and *Mistral* are equal, while *GPT-3.5* is outperformed by *Mixtral* and *Mistral* with large and by *Llama2* with small effect size. This shows that higher effectiveness comes at a considerable runtime cost.

**5.2. RQ2: Robustness**

Figure 6. Robustness indices for all the rules per test type and LLM. Table 3. Statistical tests of the robustness indices for all the rules per test type and LLM

**Table.**

|  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- |
| Metric | Model 1 | Model 2 | Comp. | *p*-value | $\hat{A}_{12}$ | Magnitude |
| $RI_{\textit{Pass}}$ | *Mistral* | *Llama2* | equal | $0.894$ | $0.457$ | negligible |
|  | *Mistral* | *Mixtral* | equal | $0.894$ | $0.44$ | negligible |
|  | *Mistral* | *GPT-3.5* | worse | $3.36\text{\times}{10}^{-05}$ | $0.236$ | large |
|  | *Llama2* | *Mixtral* | equal | $1$ | $0.486$ | negligible |
|  | *Llama2* | *GPT-3.5* | worse | $0.00128$ | $0.325$ | medium |
|  | *Mixtral* | *GPT-3.5* | worse | $0.00128$ | $0.29$ | medium |
| $RI_{\textit{Fail}}$ | *Mistral* | *Llama2* | better | $2.32\text{\times}{10}^{-06}$ | $0.771$ | large |
|  | *Mistral* | *Mixtral* | equal | $1$ | $0.526$ | negligible |
|  | *Mistral* | *GPT-3.5* | better | $0.000558$ | $0.705$ | medium |
|  | *Llama2* | *Mixtral* | worse | $4.12\text{\times}{10}^{-06}$ | $0.231$ | large |
|  | *Llama2* | *GPT-3.5* | equal | $0.489$ | $0.414$ | small |
|  | *Mixtral* | *GPT-3.5* | better | $0.00108$ | $0.708$ | medium |
| $RI_{\textit{NotApplied}}$ | *Mistral* | *Llama2* | better | $8.63\text{\times}{10}^{-05}$ | $0.787$ | large |
|  | *Mistral* | *Mixtral* | equal | $0.493$ | $0.39$ | small |
|  | *Mistral* | *GPT-3.5* | equal | $1$ | $0.444$ | negligible |
|  | *Llama2* | *Mixtral* | worse | $1.03\text{\times}{10}^{-07}$ | $0.166$ | large |
|  | *Llama2* | *GPT-3.5* | worse | $3.25\text{\times}{10}^{-06}$ | $0.227$ | large |
|  | *Mixtral* | *GPT-3.5* | equal | $1$ | $0.531$ | negligible |

This section investigates the LLM robustness $RI$ per rule and test type. Figure 6 depicts the robustness indices $RI_{\textit{Pass}}$, $RI_{\textit{Fail}}$, and $RI_{\textit{NotApplied}}$ for the *Pass*, *Fail*, and *NotApplied* tests per rule, respectively. The results are more diverse compared to the success indices: no LLM is superior across the three test types. In terms of $RI_{\textit{Pass}}$, *GPT-3.5* is most robust with a mean of $92.25741$%, followed by *Mixtral*, *Llama2*, and *Mistral* with $87.34621$%, $84.80741$%, and $84.43345$%, respectively. This is confirmed by the statistical tests (see Table 3): *GPT-3.5* is better than *Mixtral* and *Llama2* with medium and *Mistral* with large effect size. For $RI_{\textit{Fail}}$, *Mistral* and *Mixtral* tied for the most robust LLM with $86$%, followed by *GPT-3.5* with $77.40914$% and a medium effect size and *Llama2* with $71.24534$% and a large effect size. Finally for $RI_{\textit{NotApplied}}$, we do not observe statistical differences between *Mistral*, *Mixtral*, and *GPT-3.5* with $85.41750$%, $87.55125$%, and $86.20417$%, respectively. Only *Llama2* is inferior to the other three LLMs with $75.36792$% and large effect sizes.

**5.3. RQ3: Differential Testing**

We investigate matches and mismatches between *Dvare++* and *GURI*. In terms of mismatches, we categorize them based on the result type (i.e., *Pass*, *Fail*, *NotApplied*, and *Warning*) and “errors” returned by *GURI*. A *Warning* result occurs when the rule execution is successful, but the data exhibits potential issues. For example, a patient’s age might be 120 years, which is theoretically possible but highly unlikely; hence the *Warning* result. In addition, we identify two other result types: (1) *500*—thrown as an exception by *GURI* in response to invalid or non-compliant variables (e.g., date data type), deviating from the specific implementation standards. For instance, if a date is provided in a format other than expected (e.g., `YYYY-MM-DD`), it triggers a 500 Internal Server Error. (2) *Empty Response*—similar to the above error, an empty response is triggered in specific instances where certain variables dictate conditions or requirements for the rule’s execution. For example, if the diagnosis’ certainty, identified with the *“ds”* variable, is either invalid or null in a cancer message, the system generates an empty response due to pre-aggregation constraints. We have six categories based on the *GURI* result types. A mapping between *GURI* with *Dvare++* results is done to determine if a match or mismatch is observed. Table 4 shows all the observed matches and mismatches after executing each generated test. We notice that *Mixtral* has the highest number of matches, while *Mistral* has the highest number of mismatches per rule. A total of 44 rule mismatches between the *GURI* and *Dvare++* results for *Mistral*, followed by *GPT-3.5* with 32, *Llama2* with 29, and *Mixtral* with 27. In addition, we perform a manual investigation of the nature of the mismatched rules and find the following patterns: (1) *Rules that contain pre-aggregation constraints.*We observe that all 11 rules containing the “ds” variable result in an *Empty Response* when its value is invalid or missing. (2) *Rules that return 500.*We encounter two rules, specifically V47 and V53, that trigger a *500* result due to either an invalid date or a non-compliant date format. (3) *Rules that return Warning.*Among all the 58 rules, we observe only one rule, i.e., V08, which returns *Warning* instead of *Fail*. (4) *Rules that always return NotApplied.*We observe that the rules V43, V44, and V45 always return *NotApplied*, regardless of the test type (i.e., *Pass*, *Fail*, *NotApplied*). (5) *Rules that never Pass.*We observe a list of rules where older versions can never *Pass*. Specifically, V19/1, V20/1, V22/1, V27/1 (resulting always in *Fail*) and V69/1 (resulting always in *NotApplied*). Based on the identified result mismatches, we observe the following reasons why such mismatches can occur: (1) *Inconsistency in handling rule versions.*We notice that some of the rules have both versions “active” (e.g., V09/1 and V09/2), while some other rules are “inactive” for the first version. Thus, such rules never *Pass*. (2) *Inconsistency in handling date formats.*We notice that *GURI* considers `YYYY-MM-DD` as a valid date format, while `DD-MM-YYYY` is invalid, thus leading to a *500* result. (3) *Inconsistency in handling variable dependencies.*We notice that different variables are handled differently in terms of execution. For instance, the “ds” variable affects the whole cancer message (resulting in an empty response), while other variables (e.g., diagnose date) affect only specific rules (resulting always in *NotApplied*). Table 4. Matches and mismatches between *GURI* and *Dvare++* results, considering all 58 rules

**Table.**

| **Model** | **GURI Result** | **Dvare++ Result** / **Match** | **Mismatched Rules** / **Mismatch** |  |
| --- | --- | --- | --- | --- |
|  | *Pass* | 44 ($76$%) | 14 ($24.137931$%) | V19/1, V19/2, V20/1, V20/2, V21, V25, V26, V27/1, V28, V29/1, V46, V50, V51, V67 |
|  | *Fail* | 47 ($81$%) | 11 ($18.965517$%) | V17, V22/1, V22/2, V23, V24, V25, V27/1, V29/1, V46, V50, V51 |
| *Mistral* | *Not Applied* | 53 ($91$%) | 5 ($8.62068966$%) | V43, V44, V45, V46, V69/1 |
|  | *Warning* | 57 ($98$%) | 1 ($1.72413793$%) | V08 |
|  | *500* | 57 ($98$%) | 1 ($1.72413793$%) | V53 |
|  | *Empty Response* | 46 ($79$%) | 12 ($20.6896552$%) | V17, V23, V24, V25, V26, V28, V47, V49, V51, V53, V67, V65 |
|  | *Pass* | 52 ($90$%) | 6 ($10.3448276$%) | V19/2, V20/1, V20/2, V27/1, V46, V50, |
|  | *Fail* | 52 ($90$%) | 6 ($10.3448276$%) | V19/1, V20/1, V22/1, V22/2, V27/1, V50 |
| *Llama2* | *Not Applied* | 54 ($93$%) | 4 ($6.89655172$%) | V43, V44, V45, V69/1, |
|  | *Warning* | 57 ($98$%) | 1 ($1.72413793$%) | V08 |
|  | *500* | 57 ($98$%) | 1 ($1.72413793$%) | V53 |
|  | *Empty Response* | 47 ($81$%) | 11 ($18.965517$%) | V17, V23, V24, V25, V26, V28, V47, V49, V51, V65, V67 |
|  | *Pass* | 55 ($95$%) | 3 ($5.17241379$%) | V22/2, V27/1, V46 |
|  | *Fail* | 53 ($91$%) | 5 ($8.62068966$%) | V19/1, V22/1, V22/2, V27/1, V46 |
| *Mixtral* | *Not Applied* | 54 ($93$%) | 4 ($6.89655172$%) | V43, V44, V45, V69/1 |
|  | *Warning* | 57 ($98$%) | 1 ($1.72413793$%) | V08 |
|  | *500* | 56 ($97$%) | 2 ($3.44827586$%) | V47, V53 |
|  | *Empty Response* | 46 ($79$%) | 12 ($20.6896552$%) | V17, V23, V24, V25, V26, V28, V47, V49, V51, V53, V65, V67 |
|  | *Pass* | 52 ($90$%) | 6 ($10.3448276$%) | V20/2, V46, V50, V51, V64, V67 |
|  | *Fail* | 49 ($84$%) | 9 ($15.5172414$%) | V19/1, V20/1, V22/1, V22/2, V24, V26, V27/1, V46, V50 |
| *GPT-3.5* | *Not Applied* | 53 ($91$%) | 5 ($8.62068966$%) | V43, V44, V45, V46, V69/1 |
|  | *Warning* | 57 ($98$%) | 1 ($1.72413793$%) | V08 |
|  | *500* | 57 ($98$%) | 1 ($1.72413793$%) | V53 |
|  | *Empty Response* | 48 ($83$%) | 10 ($17.2413793$%) | V17, V24, V25, V26, V28, V47, V51, V53, V65, V67 |

**6. Discussion and Lessons Learned**

In this section, we discuss our learned lessons.

**6.1. Hallucination Effect**

As an indicator of potential hallucination, we consider the LLMs accuracy in following the given instructions in the prompt. We utilize the $EM$ metric as a binary evaluation to determine whether the tests generated by the LLMs are correct. Despite its common use, we identify several limitations: (1) *Semantic alterations.*This limitation refers to small semantic changes such as transforming “violation_case” to “violating_case”. While seemingly minor, such a change is considered incorrect. (2) *Different levels of detail.*We observe discrepancies in the level of detail between the expected and generated tests. This manifests in three common scenarios: (a) Missing test types: In some instances, the LLMs fail to generate all specified test types. For example, out of the three expected test types (*Pass*, *Fail*, and *NotApplied*), only two might be generated (*Pass* and *Fail*). (b) Additional tests: The LLMs might produce redundant tests, unnecessarily generating variations of the same scenario (e.g., generating “invalid_case”, “invalid_case_1”, and “invalid_case_2”). (c) Lack of integration: Tests are generated individually and not as a single JSON dictionary containing all three types. (3) *Invalid JSON format.*The JSON parser throws exceptions for issues including: (a) Improperly formatted property names: JSON requires property names to be enclosed in double quotes. (b) Missing variable and value pairs: Errors can occur when the JSON misses information, such as variable names or their corresponding values. (c) Incorrect data structure: Instead of generating the expected dictionary format (key-value pairs), the LLM generates lists. (d) Missing delimiters: JSON parsing errors also occur when expected delimiters, e.g., “:” or “,”, are missing.

**6.2. No LLM Subsumes Another**

Our differential testing results reveals that the most effective LLM (i.e., *GPT-3.5*) does not uncover the most mismatches. Surprisingly, it is *Mistral* that detects the highest number of mismatches. However, it is important to note that not all mismatches indicate faults. We identify three specific cases: (1) *inconsistency in handling rule versions,* (2) *inconsistency in handling date formats,*and (3) *inconsistency in handling variable dependencies.* While 22 rules fall into these categories, none of the LLMs manages to identify all of them. For instance, while *Mistral* successfully detects all rules involving the “ds” variable, it overlooks cases triggering a 500 status code—unlike *Mixtral*. Contrarily, *Mixtral* identifies both cases triggering a 500 status code but misses those where all the rule versions (e.g., V20/1) never *Pass*. Interestingly, both *Llama2* and *GPT-3.5* detect all the cases related to rule versions but fail to uncover the cases where *Mistral* and *Mixtral* excel. While any of the LLMs would be suited for detecting mismatches, the optimal choice for a developer or researcher requires deeper understanding of the specific inconsistency types each model excels at identifying and the concrete usage scenario. Additionally, it is important to remain open to exploring other LLMs that potentially improve on detecting specific inconsistencies or offer novel insights.

**6.3. Using LLMs Instead of Other Test Generation Techniques**

A specialized testing approach is essential for ensuring the correctness of the medical rules and their implementation in *GURI*. While common testing methods like random and coverage-guided testing are widely used [17, 51], they fall short of capturing the specifics of medical rules, such as rule context and relationships among variables. LLMeDiff introduces a customized, domain-aware strategy that leverages LLMs to generate tests tackling the unique aspects of medical rules and *GURI* (e.g., ICD codes). Moreover, as the medical rules are similar to constraints, a test generation technique might rely on constraint solvers to find suitable tests. While such solvers are efficient in finding satisfying and violating variable assignments, they may not capture the “meaning” of variable names and relationships among variables and constraints. Nonetheless, a dedicated empirical evaluation is needed to compare LLMs with other constraint-solving approaches (e.g., based on search algorithms and satisfiability modulo theories (SMT) solvers).

**6.4. LLMs Might Not Find Simple Faults**

The power of LLMs is that they can interpret the variable names to generate valid values. For dates this can be helpful, as a date string needs to follow a specific format (e.g., `YYYY-MM-DD`); otherwise, the rule engine will yield a parsing error. An LLM will always generate a date string of a valid format; however, it might never try a simple input such as a single number (e.g., `7`). This specific case would be detected in our differential testing setting, where *Dvare++* yields an error but *GURI* accepts a single number as a date variable, but the LLM never generates such a simple case. A simpler test generator, e.g., a fuzzer like *EvoMaster* [3], would likely try such an input and detect the fault.

**6.5. Mismatches $\neq$ Faults**

In RQ3, we discussed the differential testing results in terms of rule result matches and mismatches. Our study revealed that LLMeDiff serves as an effective technique for uncovering disparities within the rule engines. However, it is important to emphasize that LLMeDiff’s task is limited to flagging these mismatches. There is a potential for false positives and negatives (e.g., data overlaps between rule versions—erroneously leading to *Pass*), which complicates the interpretation of the results. False positives might stem from the reference implementation (*Dvare++*) not accurately reflecting the desired behavior of *GURI*. Therefore, determining whether these differences signify real faults in the rule engine requires manual root cause analysis by the CaReSS developers. While such false positives add work for the developers, we assume that checking whether a mismatch is a false positive will neither require much time nor effort, as a domain expert can quickly identify a false positive. Over time, the reference implementation can be adapted to handle edge cases that previously led to false positives. Alternatively, it is worth investigating whether learned models can serve as a reference implementation, e.g., a digital twin of *GURI* [29].

**6.6. Improvement on the State of the Practice**

The rule testing process at the CRN is currently done manually by medical coders, who run a set of tests against new or changed rules whenever “necessary” [27]. Instead, automated rule test generation would relieve them of this tedious task. Unfortunately, and to the best of our knowledge, there are no automatic test generation techniques for medical rule engines that have a solution for the oracle problem [5]. In our previous works, we explicitly pointed out that generating valid medical data [26], solving the oracle problem for medical rules and rule engines [26], and keeping the number of tests executed against the real system to a minimum [21] is detrimental for being applicable at the CRN. In this paper, we address these challenges by generating only three valid and realistic tests, i.e., *Pass*, *Fail*, and *NotApplied*, for each rule and using differential testing with a simple reference implementation, i.e., *Dvare++*.

**6.7. Generality of the Results**

While the results are specific to the CRN, CaReSS, and *GURI*; the medical rules used in the experiment; and the studied LLMs; we believe that LLMeDiff and the overall findings are transferable to other contexts. (1) Our findings are relevant to other health registries in Norway (e.g., rthe Norwegian Patient Registry) and similar real-world contexts, such as the Norwegian toll and customs, which implement similar rule-based systems. (2) Other countries also maintain health registries, such as cancer registries, for which our findings and lessons can provide valuable guidance for adopting and applying an LLM-based test generation approach such as LLMeDiff. (3) Our medical rules are an instance of logic-based rules or constraints; therefore, any system taking such rules as input can leverage an approach like LLMeDiff. (4) The differential testing approach of LLMeDiff uses a simple reference implementation to compare against, as alternative implementations of highly customized systems, such as *GURI*, are unlikely to exist. Hence, systems with similar settings aiming to test beyond simple crash oracles can follow a testing approach like ours.

**7. Related Work**

A typical software testing challenge in many contexts is the absence of precise and reliable test oracles [8], i.e., checking whether a test case’s outcome meets the expected outcome using a test oracle. In many real-world situations (including our context of testing medical rule engines), such an oracle either doesn’t exist or is impractical due to resource constraints. Metamorphic and differential testing techniques have been employed in the literature to deal with the test oracle problem [35, 15]. In this paper, we applied a typical differential testing setup to support testing *GURI*, i.e., using *Dvare++* as a simplified reference implementation of *GURI*. The key idea is to use *GURI* and *Dvare++* to check whether both systems produce consistent outputs when provided identical inputs generated by LLMs. Such a comparison allows for identifying inconsistencies, hence identifying possible issues in the implementation of *GURI*. As a result, we address the test oracle problem to some extent. Recently, LLMs have become popular in software testing [43], e.g., focusing on unit testing [16, 47], system input generation [12, 11], property-based test generation [42], and test oracle generation [40]. Our work is similar to these works, focusing on generating tests with LLMs that let medical rules yield *Pass*, *Fail*, or *NotApplied* results; however, the application context is specific to the medical domain. Consequently, our work is related to the works that aim to explore the potential of LLMs in the medical domain. For example, Zhang et al. [49] evaluates the performance of LLMs, including GPT-3.5, GPT-4, Falcon, and LLama 2, in the classification of medical terms, specifically using a metastatic cancer dataset to assess reasoning consistency. Wornow et al. [46] evaluates models such as GPT-4 on clinical text and concludes that many models are trained on small or broad biomedical datasets, emphasizing the importance of a better evaluation system that aligns with healthcare standards. In general, surveys [34, 38, 10] provide insights into the potential and challenges of LLMs in healthcare applications and highlight that the practical use of LLMs remains limited. Our work with the CRN is a step towards the practical deployment of LLMs for testing their software systems. In the past, we developed a model-based framework to model the medical rules for *GURI* [44] with the Unified Modeling Language (UML) and Object Constraint Language (OCL). Next, we developed an impact analysis approach [45] to study the impact of rule changes in response to *GURI*’s evolution (e.g., changes in regulations). In addition, we developed a search-based approach to automatically refactor rules [30] to enhance rule understandability and maintainability. However, these approaches do not help finding problems in the modeled rules. More recently, four studies advanced the testing at the CRN, mainly focusing on the *GURI* subsystem [26, 27, 21, 29]. Laaber et al. [27] address the practical complexities of testing an evolving system, offering insights applicable to healthcare registries. Moreover, a case study focused on applying EvoMaster [3] (an AI-based testing tool) to assess its effectiveness regarding code coverage, error detection, and domain-specific rule coverage at the CRN [26]. Meanwhile, we also proposed EvoClass [21] by extending EvoMaster with a ML classifier, showing significant cost reductions without compromising effectiveness. Lastly, EvoCLINICAL [29], a cyber-cyber digital twin for *GURI*, was proposed, which with fine-tuning through active transfer learning, can deal with system evolution. In contrast to these existing works, we make new contributions by addressing the test oracle problem associated with rule execution results by employing differential testing. Moreover, we tackle the challenge of generating electronic health records (EHRs) by leveraging the capabilities of LLMs.

**8. Conclusions**

This paper presented LLMeDiff, an LLM-based test generation approach for medical rules employed to perform differential testing of *GURI*, the CRN’s medical rule web service. While we find that LLMeDiff is effective in generating tests and finding mismatches, there are a few future directions worth investigating: (1) generate functions with LLMs that produce *Pass*, *Fail*, and *NotApplied* tests; (2) using LLMs to generate rule mutations; (3) fine-tune an LLM with domain-specific EHRs and CRN data; and (4) combine other test generation techniques with LLMeDiff.

**Data Availability**

Due to confidentiality, we can not disclose the data, scripts, and systems that lead to the results of the paper.

**Acknowledgements.**

The research presented in this paper has received funding from The Research Council of Norway (RCN) under the project `309642` and has benefited from the Experimental Infrastructure for Exploration of Exascale Computing (eX^3), which is supported by the RCN project `270053`. The Norwegian Ministry of Education and Research supports Erblin Isaku’s PhD.

## Footnotes

- **1** `https://github.com/dvare/dvare-framework/`
- **2** `https://huggingface.co/`
- **3** `https://platform.openai.com/docs/api-reference/introduction/`
- **4** `https://rasa.com/docs/rasa/next/llms/llm-intent/`
- **5** `https://fireworks.ai/`
- **6** `https://openai.com/`

## References

- [2] Ali Al-Kaswan, Toufique Ahmed, Maliheh Izadi, Anand Ashok Sawant, Premkumar T. Devanbu, and Arie van Deursen. 2023. Extending Source Code Pre-Trained Language Models to Summarise Decompiled Binarie. In *IEEE International Conference on Software Analysis, Evolution and Reengineering, SANER 2023, Taipa, Macao, March 21-24, 2023*, Tao Zhang, Xin Xia, and Nicole Novielli (Eds.). IEEE, 260–271. `https://doi.org/10.1109/SANER56733.2023.00033`
- [3] Andrea Arcuri. 2019. RESTful API Automated Test Case Generation with EvoMaster. *ACM Transactions on Software Engineering and Methodology* 28, 1 (Feb. 2019), 1–37. `https://doi.org/10.1145/3293455`
- [4] Andrea Arcuri and Lionel Briand. 2011. A Practical Guide for Using Statistical Tests to Assess Randomized Algorithms in Software Engineering. In *Proceedings of the 33rd International Conference on Software Engineering* *(ICSE 2011)*. ACM. `https://doi.org/10.1145/1985793.1985795`
- [5] Earl T. Barr, Mark Harman, Phil McMinn, Muzammil Shahbaz, and Shin Yoo. 2015. The Oracle Problem in Software Testing: A Survey. *IEEE Transactions on Software Engineering* 41, 5 (May 2015), 507–525. `https://doi.org/10.1109/tse.2014.2372785`
- [6] Yoav Benjamini and Daniel Yekutieli. 2001. The Control of the False Discovery Rate in Multiple Testing under Dependency. *The Annals of Statistics* 29, 4 (Aug. 2001), 1165–1188. `https://doi.org/10.1214/aos/1013699998`
- [7] Saikat Chakraborty, Toufique Ahmed, Yangruibo Ding, Premkumar T. Devanbu, and Baishakhi Ray. 2022. NatGen: generative pre-training by ”naturalizing” source code. In *Proceedings of the 30th ACM Joint European Software Engineering Conference and Symposium on the Foundations of Software Engineering, ESEC/FSE 2022, Singapore, Singapore, November 14-18, 2022*, Abhik Roychoudhury, Cristian Cadar, and Miryung Kim (Eds.). ACM, 18–30. `https://doi.org/10.1145/3540250.3549162`
- [8] Tsong Yueh Chen, Fei-Ching Kuo, Huai Liu, Pak-Lok Poon, Dave Towey, T. H. Tse, and Zhi Quan Zhou. 2018. Metamorphic Testing: A Review of Challenges and Opportunities. *Comput. Surveys* 51, 1 (2018), 4:1–4:27. `https://doi.org/10.1145/3143561`
- [9] John Joon Young Chung, Ece Kamar, and Saleema Amershi. 2023. Increasing Diversity While Maintaining Accuracy: Text Data Generation with Large Language Models and Human Interventions. In *Proceedings of the 61st Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers), ACL 2023, Toronto, Canada, July 9-14, 2023*, Anna Rogers, Jordan L. Boyd-Graber, and Naoaki Okazaki (Eds.). Association for Computational Linguistics, 575–593. `https://doi.org/10.18653/V1/2023.ACL-LONG.34`
- [10] Jan Clusmann, Fiona R Kolbinger, Hannah Sophie Muti, Zunamys I Carrero, Jan-Niklas Eckardt, Narmin Ghaffari Laleh, Chiara Maria Lavinia Löffler, Sophie-Caroline Schwarzkopf, Michaela Unger, Gregory P Veldhuizen, et al. 2023. The future landscape of large language models in medicine. *Communications Medicine* 3, 1 (2023), 141.
- [11] Arghavan Moradi Dakhel, Amin Nikanjam, Vahid Majdinasab, Foutse Khomh, and Michel C. Desmarais. 2023. Effective Test Generation Using Pre-trained Large Language Models and Mutation Testing. *CoRR* abs/2308.16557 (2023). `https://doi.org/10.48550/ARXIV.2308.16557` arXiv:2308.16557
- [12] Yinlin Deng, Chunqiu Steven Xia, Haoran Peng, Chenyuan Yang, and Lingming Zhang. 2023. Large Language Models Are Zero-Shot Fuzzers: Fuzzing Deep-Learning Libraries via Large Language Models. In *Proceedings of the 32nd ACM SIGSOFT International Symposium on Software Testing and Analysis, ISSTA 2023, Seattle, WA, USA, July 17-21, 2023*, René Just and Gordon Fraser (Eds.). ACM, 423–435. `https://doi.org/10.1145/3597926.3598067`
- [13] Olive Jean Dunn. 1964. Multiple Comparisons Using Rank Sums. *Technometrics* 6, 3 (Aug. 1964), 241–252. `https://doi.org/10.1080/00401706.1964.10490181`
- [14] Shuzheng Gao, Xin-Cheng Wen, Cuiyun Gao, Wenxuan Wang, Hongyu Zhang, and Michael R. Lyu. 2023. What Makes Good In-Context Demonstrations for Code Intelligence Tasks with LLMs?. In *38th IEEE/ACM International Conference on Automated Software Engineering, ASE 2023, Luxembourg, September 11-15, 2023*. IEEE, 761–773. `https://doi.org/10.1109/ASE56229.2023.00109`
- [15] Patrice Godefroid, Daniel Lehmann, and Marina Polishchuk. 2020. Differential regression testing for REST APIs. In *ISSTA ’20: 29th ACM SIGSOFT International Symposium on Software Testing and Analysis, Virtual Event, USA, July 18-22, 2020*, Sarfraz Khurshid and Corina S. Pasareanu (Eds.). ACM, 312–323. `https://doi.org/10.1145/3395363.3397374`
- [16] Vitor Guilherme and Auri Vincenzi. 2023. An initial investigation of ChatGPT unit test generation capability. In *8th Brazilian Symposium on Systematic and Automated Software Testing, SAST 2023, Campo Grande, MS, Brazil, September 25-29, 2023*, Awdren L. Fontão, Débora M. B. Paiva, Hudson Borges, Maria Istela Cagnin, Patrícia Gomes Fernandes, Vanessa Borges, Silvana M. Melo, Vinicius H. S. Durelli, and Edna Dias Canedo (Eds.). ACM, 15–24. `https://doi.org/10.1145/3624032.3624035`
- [17] Richard G. Hamlet. 2021. Random Testing. *Essentials of Software Testing* (2021). `https://api.semanticscholar.org/CorpusID:6665543`
- [18] Melinda R. Hess and Jeffrey D. Kromrey. 2004. Robust Confidence Intervals for Effect Sizes: A Comparative Study of Cohen’s d and Cliff’s Delta Under Non-Normality and Heterogeneous Variances. *Annual Meeting of the American Educational Research Association* (April 2004).
- [19] Lei Huang, Weijiang Yu, Weitao Ma, Weihong Zhong, Zhangyin Feng, Haotian Wang, Qianglong Chen, Weihua Peng, Xiaocheng Feng, Bing Qin, and Ting Liu. 2023. A Survey on Hallucination in Large Language Models: Principles, Taxonomy, Challenges, and Open Questions. *CoRR* abs/2311.05232 (2023). `https://doi.org/10.48550/ARXIV.2311.05232` arXiv:2311.05232
- [20] Sangwon Hyun, Mingyu Guo, and Muhammad Ali Babar. 2023. METAL: Metamorphic Testing Framework for Analyzing Large-Language Model Qualities. *CoRR* abs/2312.06056 (2023). `https://doi.org/10.48550/ARXIV.2312.06056` arXiv:2312.06056
- [21] Erblin Isaku, Hassan Sartaj, Christoph Laaber, Shaukat Ali, Tao Yue, Thomas Schwitalla, and Jan F. Nygård. 2023. Cost Reduction on Testing Evolving Cancer Registry System. In *Proceedings of the 39th IEEE International Conference on Software Maintenance and Evolution* *(ICSME 2023)*. IEEE.
- [22] Yue Jia and Mark Harman. 2011. An Analysis and Survey of the Development of Mutation Testing. *IEEE Transactions on Software Engineering* 37, 5 (Sept. 2011), 649–678. `https://doi.org/10.1109/TSE.2010.62`
- [23] Albert Q. Jiang, Alexandre Sablayrolles, Arthur Mensch, Chris Bamford, Devendra Singh Chaplot, Diego de Las Casas, Florian Bressand, Gianna Lengyel, Guillaume Lample, Lucile Saulnier, Lélio Renard Lavaud, Marie-Anne Lachaux, Pierre Stock, Teven Le Scao, Thibaut Lavril, Thomas Wang, Timothée Lacroix, and William El Sayed. 2023. Mistral 7B. *CoRR* abs/2310.06825 (2023). `https://doi.org/10.48550/ARXIV.2310.06825` arXiv:2310.06825
- [24] Albert Q. Jiang, Alexandre Sablayrolles, Antoine Roux, Arthur Mensch, Blanche Savary, Chris Bamford, Devendra Singh Chaplot, Diego de Las Casas, Emma Bou Hanna, Florian Bressand, Gianna Lengyel, Guillaume Bour, Guillaume Lample, Lélio Renard Lavaud, Lucile Saulnier, Marie-Anne Lachaux, Pierre Stock, Sandeep Subramanian, Sophia Yang, Szymon Antoniak, Teven Le Scao, Théophile Gervet, Thibaut Lavril, Thomas Wang, Timothée Lacroix, and William El Sayed. 2024. Mixtral of Experts. *CoRR* abs/2401.04088 (2024). `https://doi.org/10.48550/ARXIV.2401.04088` arXiv:2401.04088
- [25] William H. Kruskal and W. Allen Wallis. 1952. Use of Ranks in One-Criterion Variance Analysis. *J. Amer. Statist. Assoc.* 47, 260 (Dec. 1952), 583–621. `https://doi.org/10.1080/01621459.1952.10483441`
- [26] Christoph Laaber, Tao Yue, Shaukat Ali, Thomas Schwitalla, and Jan F. Nygård. 2023a. Automated Test Generation for Medical Rules Web Services: A Case Study at the Cancer Registry of Norway. In *Proceedings of the 31st ACM Joint European Software Engineering Conference and Symposium on the Foundations of Software Engineering* *(ESEC/FSE 2023)*. ACM. `https://doi.org/10.1145/3611643.3613882`
- [27] Christoph Laaber, Tao Yue, Shaukat Ali, Thomas Schwitalla, and Jan F. Nygård. 2023b. Challenges of Testing an Evolving Cancer Registration Support System in Practice. In *Proceedings of the 45th IEEE/ACM International Conference on Software Engineering: Companion Proceedings* *(ICSE-Companion 2023)*. IEEE, 355–359. `https://doi.org/10.1109/ICSE-Companion58688.2023.00102`
- [28] Juho Leinonen, Arto Hellas, Sami Sarsa, Brent N. Reeves, Paul Denny, James Prather, and Brett A. Becker. 2023. Using Large Language Models to Enhance Programming Error Messages. In *Proceedings of the 54th ACM Technical Symposium on Computer Science Education, Volume 1, SIGCSE 2023, Toronto, ON, Canada, March 15-18, 2023*, Maureen Doyle, Ben Stephenson, Brian Dorn, Leen-Kiat Soh, and Lina Battestilli (Eds.). ACM, 563–569. `https://doi.org/10.1145/3545945.3569770`
- [29] Chengjie Lu, Qinghua Xu, Tao Yue, Shaukat Ali, Thomas Schwitalla, and Jan Nygård. 2023. EvoCLINICAL: Evolving Cyber-Cyber Digital Twin with Active Transfer Learning for Automated Cancer Registry System. In *Proceedings of the 31st ACM Joint European Software Engineering Conference and Symposium on the Foundations of Software Engineering, ESEC/FSE 2023, San Francisco, CA, USA, December 3-9, 2023*, Satish Chandra, Kelly Blincoe, and Paolo Tonella (Eds.). ACM, 1973–1984. `https://doi.org/10.1145/3611643.3613897`
- [30] Hong Lu, Shuai Wang, Tao Yue, Shaukat Ali, and Jan F. Nygård. 2019. Automated Refactoring of OCL Constraints with Search. *IEEE Trans. Software Eng.* 45, 2 (2019), 148–170. `https://doi.org/10.1109/TSE.2017.2774829`
- [31] William M. McKeeman. 1998. Differential Testing for Software. *Digital Technical Journal* 10, 1 (1998), 100–107. `https://www.hpl.hp.com/hpjournal/dtj/vol10num1/vol10num1art9.pdf`
- [32] OpenAI. 2023. GPT-4 Technical Report. *CoRR* abs/2303.08774 (2023). `https://doi.org/10.48550/ARXIV.2303.08774` arXiv:2303.08774
- [33] OpenAI. [2024]. GPT 3.5. `https://platform.openai.com/docs/models/gpt-3-5`
- [34] Cheng Peng, Xi Yang, Aokun Chen, Kaleb E. Smith, Nima M. Pournejatian, Anthony B. Costa, Cheryl Martin, Mona G. Flores, Ying Zhang, Tanja Magoc, Gloria P. Lipori, Duane A. Mitchell, Naykky Singh Ospina, Mustafa M. Ahmed, William R. Hogan, Elizabeth A. Shenkman, Yi Guo, Jiang Bian, and Yonghui Wu. 2023. A study of generative large language model for medical research and healthcare. *npj Digitital Medicine* 6 (2023). `https://doi.org/10.1038/S41746-023-00958-W`
- [35] Sergio Segura, José Antonio Parejo, Javier Troya, and Antonio Ruiz Cortés. 2018. Metamorphic Testing of RESTful Web APIs. *IEEE Trans. Software Eng.* 44, 11 (2018), 1083–1099. `https://doi.org/10.1109/TSE.2017.2764464`
- [36] Lijun Shan and Hong Zhu. 2009. Generating Structurally Complex Test Cases By Data Mutation: A Case Study Of Testing An Automated Modelling Tool. *Comput. J.* 52, 5 (2009), 571–588. `https://doi.org/10.1093/COMJNL/BXM043`
- [37] Klaas-Jan Stol and Brian Fitzgerald. 2018. The ABC of Software Engineering Research. *ACM Transactions on Software Engineering and Methodology* 27, 3 (Oct. 2018), 1–51. `https://doi.org/10.1145/3241743`
- [38] Arun James Thirunavukarasu, Darren Shu Jeng Ting, Kabilan Elangovan, Laura Gutierrez, Ting Fang Tan, and Daniel Shu Wei Ting. 2023. Large Language Models in Medicine. *Nature medicine* 29, 8 (2023), 1930–1940.
- [39] Hugo Touvron, Louis Martin, Kevin Stone, Peter Albert, Amjad Almahairi, Yasmine Babaei, Nikolay Bashlykov, Soumya Batra, Prajjwal Bhargava, Shruti Bhosale, Dan Bikel, Lukas Blecher, Cristian Canton-Ferrer, Moya Chen, Guillem Cucurull, David Esiobu, Jude Fernandes, Jeremy Fu, Wenyin Fu, Brian Fuller, Cynthia Gao, Vedanuj Goswami, Naman Goyal, Anthony Hartshorn, Saghar Hosseini, Rui Hou, Hakan Inan, Marcin Kardas, Viktor Kerkez, Madian Khabsa, Isabel Kloumann, Artem Korenev, Punit Singh Koura, Marie-Anne Lachaux, Thibaut Lavril, Jenya Lee, Diana Liskovich, Yinghai Lu, Yuning Mao, Xavier Martinet, Todor Mihaylov, Pushkar Mishra, Igor Molybog, Yixin Nie, Andrew Poulton, Jeremy Reizenstein, Rashi Rungta, Kalyan Saladi, Alan Schelten, Ruan Silva, Eric Michael Smith, Ranjan Subramanian, Xiaoqing Ellen Tan, Binh Tang, Ross Taylor, Adina Williams, Jian Xiang Kuan, Puxin Xu, Zheng Yan, Iliyan Zarov, Yuchen Zhang, Angela Fan, Melanie Kambadur, Sharan Narang, Aurélien Rodriguez, Robert Stojnic, Sergey Edunov, and Thomas Scialom. 2023. Llama 2: Open Foundation and Fine-Tuned Chat Models. *CoRR* abs/2307.09288 (2023). `https://doi.org/10.48550/ARXIV.2307.09288` arXiv:2307.09288
- [40] Michele Tufano, Dawn Drain, Alexey Svyatkovskiy, and Neel Sundaresan. 2022. Generating Accurate Assert Statements for Unit Test Cases using Pretrained Transformers. In *IEEE/ACM International Conference on Automation of Software Test, AST@ICSE 2022, Pittsburgh, PA, USA, May 21-22, 2022*. ACM/IEEE, 54–64. `https://doi.org/10.1145/3524481.3527220`
- [41] András Vargha and Harold D. Delaney. 2000. A Critique and Improvement of the ”CL” Common Language Effect Size Statistics of McGraw and Wong. *Journal of Educational and Behavioral Statistics* 25, 2 (2000), 101–132. `https://doi.org/10.2307/1165329`
- [42] Vasudev Vikram, Caroline Lemieux, and Rohan Padhye. 2023. Can Large Language Models Write Good Property-Based Tests? *CoRR* abs/2307.04346 (2023). `https://doi.org/10.48550/ARXIV.2307.04346` arXiv:2307.04346
- [43] Junjie Wang, Yuchao Huang, Chunyang Chen, Zhe Liu, Song Wang, and Qing Wang. 2023. Software Testing with Large Language Model: Survey, Landscape, and Vision. *CoRR* abs/2307.07221 (2023). `https://doi.org/10.48550/ARXIV.2307.07221` arXiv:2307.07221
- [44] Shuai Wang, Hong Lu, Tao Yue, Shaukat Ali, and Jan Nygård. 2016. MBF4CR: A Model-Based Framework for Supporting an Automated Cancer Registry System. In *Modelling Foundations and Applications - 12th European Conference, ECMFA@STAF 2016, Vienna, Austria, July 6-7, 2016, Proceedings* *(Lecture Notes in Computer Science, Vol. 9764)*, Andrzej Wasowski and Henrik Lönn (Eds.). Springer, 191–204. `https://doi.org/10.1007/978-3-319-42061-5_12`
- [45] Shuai Wang, Thomas Schwitalla, Tao Yue, Shaukat Ali, and Jan F. Nygård. 2017. RCIA: Automated Change Impact Analysis to Facilitate a Practical Cancer Registry System. In *2017 IEEE International Conference on Software Maintenance and Evolution, ICSME 2017, Shanghai, China, September 17-22, 2017*. IEEE Computer Society, 603–612. `https://doi.org/10.1109/ICSME.2017.22`
- [46] Michael Wornow, Yizhe Xu, Rahul Thapa, Birju S. Patel, Ethan Steinberg, Scott L. Fleming, Michael A. Pfeffer, Jason Alan Fries, and Nigam H. Shah. 2023. The shaky foundations of large language models and foundation models for electronic health records. *npj Digitital Medicine* 6 (2023). `https://doi.org/10.1038/S41746-023-00879-8`
- [47] Zhuokui Xie, Yinghao Chen, Chen Zhi, Shuiguang Deng, and Jianwei Yin. 2023. ChatUniTest: a ChatGPT-based automated unit test generation tool. *CoRR* abs/2305.04764 (2023). `https://doi.org/10.48550/ARXIV.2305.04764` arXiv:2305.04764
- [48] Frank F. Xu, Uri Alon, Graham Neubig, and Vincent Josua Hellendoorn. 2022. A systematic evaluation of large language models of code. In *Proceedings of the 6th ACM SIGPLAN International Symposium on Machine Programming* *(MAPS@PLDI 2022)*, Swarat Chaudhuri and Charles Sutton (Eds.). ACM, 1–10. `https://doi.org/10.1145/3520312.3534862`
- [49] Xiaodan Zhang, Sandeep Vemulapalli, Nabasmita Talukdar, Sumyeong Ahn, Jiankun Wang, Han Meng, Sardar Mehtab Bin Murtaza, Aakash Ajay Dave, Dmitry Leshchiner, Dimitri F. Joseph, Martin Witteveen-Lane, Dave Chesla, Jiayu Zhou, and Bin Chen. 2023a. Large Language Models in Medical Term Classification and Unexpected Misalignment Between Response and Reasoning. *CoRR* abs/2312.14184 (2023). `https://doi.org/10.48550/ARXIV.2312.14184` arXiv:2312.14184
- [50] Yifan Zhang, Jingqin Yang, Yang Yuan, and Andrew Chi-Chih Yao. 2023b. Cumulative Reasoning with Large Language Models. *CoRR* abs/2308.04371 (2023). `https://doi.org/10.48550/ARXIV.2308.04371` arXiv:2308.04371
- [51] Hong Zhu, Patrick A. V. Hall, and John H. R. May. 1997. Software Unit Test Coverage and Adequacy. *Comput. Surveys* 29, 4 (1997), 366–427. `https://doi.org/10.1145/267580.267590`
